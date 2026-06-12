from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import pandas as pd
import os
import json
from datetime import datetime
from scraper import GoogleMapsScraper
import asyncio
from typing import List
import logging
import traceback

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("WebSocket connection established")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info("WebSocket connection closed")

    async def send_message(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending message: {str(e)}")

manager = ConnectionManager()

@app.post("/upload-cities")
async def upload_cities(file: UploadFile = File(...)):
    """Upload Excel file with cities"""
    try:
        # Validate file type
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Please upload an Excel file (.xlsx or .xls)"
            )
        
        contents = await file.read()
        
        # Check if file is empty
        if len(contents) == 0:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty"
            )
        
        # Save uploaded file
        os.makedirs("uploads", exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_path = f"uploads/{timestamp}_{file.filename}"
        
        with open(file_path, "wb") as f:
            f.write(contents)
        
        # Read Excel file
        try:
            df = pd.read_excel(file_path)
        except Exception as e:
            logger.error(f"Error reading Excel file: {str(e)}")
            raise HTTPException(
                status_code=400,
                detail=f"Failed to read Excel file: {str(e)}. Please ensure it's a valid Excel file."
            )
        
        # Validate columns
        required_columns = ['City', 'State']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {', '.join(missing_columns)}. Your Excel must have 'City' and 'State' columns."
            )
        
        # Remove empty rows
        df = df.dropna(subset=['City', 'State'])
        
        if len(df) == 0:
            raise HTTPException(
                status_code=400,
                detail="No valid data found. Please ensure your Excel has city and state information."
            )
        
        # Convert to list of dictionaries
        cities = df[['City', 'State']].to_dict('records')
        
        logger.info(f"Successfully uploaded {len(cities)} cities")
        
        return {
            "success": True,
            "cities_count": len(cities),
            "cities": cities,
            "file_path": file_path
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in upload: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {str(e)}"
        )

@app.websocket("/ws/scrape")
async def websocket_scrape(websocket: WebSocket):
    """WebSocket endpoint for real-time scraping"""
    await manager.connect(websocket)
    
    try:
        # Receive scraping configuration
        try:
            data = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
        except asyncio.TimeoutError:
            await manager.send_message({
                "type": "error",
                "message": "Connection timeout: No configuration received"
            }, websocket)
            return
        
        # Validate received data
        keyword = data.get('keyword')
        cities = data.get('cities')
        max_per_city = data.get('max_per_city', 100)
        
        if not keyword:
            await manager.send_message({
                "type": "error",
                "message": "No keyword provided"
            }, websocket)
            return
        
        if not cities or len(cities) == 0:
            await manager.send_message({
                "type": "error",
                "message": "No cities provided"
            }, websocket)
            return
        
        job_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = "output"
        os.makedirs(output_dir, exist_ok=True)
        
        output_file = f"{output_dir}/{keyword.lower().replace(' ', '_')}_{job_id}.csv"
        
        # Initialize results list
        all_results = []
        
        async def progress_callback(message):
            try:
                await manager.send_message({
                    "type": "progress",
                    "message": message
                }, websocket)
            except Exception as e:
                logger.error(f"Error in progress callback: {str(e)}")
        
        try:
            scraper = GoogleMapsScraper(progress_callback=progress_callback)
            total_cities = len(cities)
            
            for index, city_data in enumerate(cities):
                city = city_data.get('City', '').strip()
                state = city_data.get('State', '').strip()
                
                if not city or not state:
                    logger.warning(f"Skipping invalid city data at index {index}")
                    continue
                
                await manager.send_message({
                    "type": "status",
                    "current_city": city,
                    "current_state": state,
                    "progress": f"{index + 1}/{total_cities}",
                    "total_records": len(all_results)
                }, websocket)
                
                try:
                    # Scrape businesses
                    businesses = await scraper.scrape_businesses(
                        keyword=keyword,
                        city=city,
                        state=state,
                        max_results=max_per_city
                    )
                    
                    all_results.extend(businesses)
                    
                    # Save incrementally
                    if all_results:
                        df = pd.DataFrame(all_results)
                        df.to_csv(output_file, index=False)
                    
                    await manager.send_message({
                        "type": "city_complete",
                        "city": city,
                        "businesses_found": len(businesses),
                        "total_records": len(all_results)
                    }, websocket)
                    
                except Exception as e:
                    logger.error(f"Error scraping {city}, {state}: {str(e)}")
                    await manager.send_message({
                        "type": "progress",
                        "message": f"⚠️ Error scraping {city}: {str(e)}"
                    }, websocket)
                    continue
            
            # Save final results
            if all_results:
                df = pd.DataFrame(all_results)
                df.to_csv(output_file, index=False)
                
                # Also save as Excel
                excel_file = output_file.replace('.csv', '.xlsx')
                df.to_excel(excel_file, index=False)
                
                await manager.send_message({
                    "type": "complete",
                    "total_records": len(all_results),
                    "csv_file": os.path.basename(output_file),
                    "excel_file": os.path.basename(excel_file)
                }, websocket)
            else:
                await manager.send_message({
                    "type": "error",
                    "message": "No businesses found. Please try different cities or keywords."
                }, websocket)
            
        except Exception as e:
            logger.error(f"Error in scraping loop: {str(e)}\n{traceback.format_exc()}")
            await manager.send_message({
                "type": "error",
                "message": f"Scraping error: {str(e)}"
            }, websocket)
        
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected by client")
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}\n{traceback.format_exc()}")
        try:
            await manager.send_message({
                "type": "error",
                "message": f"Server error: {str(e)}"
            }, websocket)
        except:
            pass
    finally:
        manager.disconnect(websocket)

@app.get("/download/{filename}")
async def download_file(filename: str):
    """Download results file"""
    # Sanitize filename
    filename = os.path.basename(filename)
    file_path = f"output/{filename}"
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(file_path, filename=filename)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/")
async def root():
    return {
        "message": "Google Maps Scraper API",
        "version": "1.0.0",
        "endpoints": {
            "upload": "/upload-cities",
            "scrape": "/ws/scrape",
            "download": "/download/{filename}",
            "health": "/health"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
