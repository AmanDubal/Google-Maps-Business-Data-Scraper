
from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import pandas as pd
import os
import json
from datetime import datetime
from scraper import GoogleMapsScraper
import asyncio
from typing import List

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active scraping jobs
active_jobs = {}

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

manager = ConnectionManager()

@app.post("/upload-cities")
async def upload_cities(file: UploadFile = File(...)):
    """Upload Excel file with cities"""
    try:
        contents = await file.read()
        
        # Save uploaded file
        os.makedirs("uploads", exist_ok=True)
        file_path = f"uploads/{file.filename}"
        
        with open(file_path, "wb") as f:
            f.write(contents)
        
        # Read Excel file
        df = pd.read_excel(file_path)
        
        # Validate columns
        if 'City' not in df.columns or 'State' not in df.columns:
            return {"error": "Excel must have 'City' and 'State' columns"}
        
        cities = df.to_dict('records')
        
        return {
            "success": True,
            "cities_count": len(cities),
            "cities": cities,
            "file_path": file_path
        }
    
    except Exception as e:
        return {"error": str(e)}

@app.websocket("/ws/scrape")
async def websocket_scrape(websocket: WebSocket):
    """WebSocket endpoint for real-time scraping"""
    await manager.connect(websocket)
    
    try:
        # Receive scraping configuration
        data = await websocket.receive_json()
        keyword = data.get('keyword')
        cities = data.get('cities')
        max_per_city = data.get('max_per_city', 100)
        
        job_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = f"output/{keyword.lower().replace(' ', '_')}_{job_id}.csv"
        
        os.makedirs("output", exist_ok=True)
        
        # Initialize results list
        all_results = []
        
        async def progress_callback(message):
            await manager.send_message({
                "type": "progress",
                "message": message
            }, websocket)
        
        scraper = GoogleMapsScraper(progress_callback=progress_callback)
        
        total_cities = len(cities)
        
        for index, city_data in enumerate(cities):
            city = city_data['City']
            state = city_data['State']
            
            await manager.send_message({
                "type": "status",
                "current_city": city,
                "current_state": state,
                "progress": f"{index + 1}/{total_cities}",
                "total_records": len(all_results)
            }, websocket)
            
            # Scrape businesses
            businesses = await scraper.scrape_businesses(
                keyword=keyword,
                city=city,
                state=state,
                max_results=max_per_city
            )
            
            all_results.extend(businesses)
            
            # Save incrementally
            df = pd.DataFrame(all_results)
            df.to_csv(output_file, index=False)
            
            await manager.send_message({
                "type": "city_complete",
                "city": city,
                "businesses_found": len(businesses),
                "total_records": len(all_results)
            }, websocket)
        
        # Save final results
        df = pd.DataFrame(all_results)
        df.to_csv(output_file, index=False)
        
        # Also save as Excel
        excel_file = output_file.replace('.csv', '.xlsx')
        df.to_excel(excel_file, index=False)
        
        await manager.send_message({
            "type": "complete",
            "total_records": len(all_results),
            "csv_file": output_file,
            "excel_file": excel_file
        }, websocket)
        
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        await manager.send_message({
            "type": "error",
            "message": str(e)
        }, websocket)

@app.get("/download/{filename}")
async def download_file(filename: str):
    """Download results file"""
    file_path = f"output/{filename}"
    if os.path.exists(file_path):
        return FileResponse(file_path, filename=filename)
    return {"error": "File not found"}

@app.get("/")
async def root():
    return {"message": "Google Maps Scraper API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
