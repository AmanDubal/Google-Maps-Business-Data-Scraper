import asyncio
import re
from playwright.async_api import async_playwright
from typing import List, Dict
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GoogleMapsScraper:
    def __init__(self, progress_callback=None):
        self.progress_callback = progress_callback
        self.seen_businesses = set()
        
    async def scrape_businesses(self, keyword: str, city: str, state: str, max_results: int = 100):
        """Scrape businesses from Google Maps"""
        query = f"{keyword} {city} {state}"
        businesses = []
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            try:
                # Navigate to Google Maps
                await page.goto("https://www.google.com/maps", timeout=60000)
                await page.wait_for_timeout(2000)
                
                # Search for the query
                search_box = page.locator('input[id="searchboxinput"]')
                await search_box.fill(query)
                await search_box.press("Enter")
                
                if self.progress_callback:
                    await self.progress_callback(f"Searching: {query}")
                
                await page.wait_for_timeout(3000)
                
                # Wait for results to load
                try:
                    await page.wait_for_selector('div[role="feed"]', timeout=10000)
                except:
                    logger.warning(f"No results found for {query}")
                    await browser.close()
                    return businesses
                
                # Scroll to load more results
                businesses = await self._scroll_and_extract(page, keyword, city, state, max_results)
                
            except Exception as e:
                logger.error(f"Error scraping {query}: {str(e)}")
            finally:
                await browser.close()
        
        return businesses
    
    async def _scroll_and_extract(self, page, keyword: str, city: str, state: str, max_results: int):
        """Scroll through results and extract business data"""
        businesses = []
        previous_count = 0
        no_change_count = 0
        
        while len(businesses) < max_results:
            # Get all business cards
            results = await page.locator('div[role="feed"] > div > div[jsaction]').all()
            
            for result in results:
                if len(businesses) >= max_results:
                    break
                
                try:
                    business_data = await self._extract_business_data(result, page, keyword, city, state)
                    
                    if business_data and business_data['name'] not in self.seen_businesses:
                        self.seen_businesses.add(business_data['name'])
                        businesses.append(business_data)
                        
                        if self.progress_callback:
                            await self.progress_callback(f"Found {len(businesses)} businesses in {city}")
                
                except Exception as e:
                    logger.debug(f"Error extracting business: {str(e)}")
                    continue
            
            # Check if we're getting new results
            if len(businesses) == previous_count:
                no_change_count += 1
                if no_change_count >= 3:
                    break
            else:
                no_change_count = 0
            
            previous_count = len(businesses)
            
            # Scroll to load more
            await page.locator('div[role="feed"]').evaluate('(el) => el.scrollTo(0, el.scrollHeight)')
            await page.wait_for_timeout(2000)
        
        return businesses
    
    async def _extract_business_data(self, element, page, keyword: str, city: str, state: str):
        """Extract data from a single business element"""
        try:
            # Click to open details
            await element.click()
            await page.wait_for_timeout(1500)
            
            business_data = {
                'name': '',
                'category': '',
                'address': '',
                'phone': '',
                'website': '',
                'rating': '',
                'reviews': '',
                'maps_url': '',
                'latitude': '',
                'longitude': '',
                'city': city,
                'state': state,
                'keyword': keyword
            }
            
            # Extract business name
            try:
                name_elem = page.locator('h1.DUwDvf')
                business_data['name'] = await name_elem.inner_text(timeout=3000)
            except:
                pass
            
            # Extract category
            try:
                category_elem = page.locator('button[jsaction*="category"]').first
                business_data['category'] = await category_elem.inner_text(timeout=2000)
            except:
                pass
            
            # Extract rating and reviews
            try:
                rating_elem = page.locator('div.F7nice span[aria-hidden="true"]').first
                business_data['rating'] = await rating_elem.inner_text(timeout=2000)
            except:
                pass
            
            try:
                reviews_elem = page.locator('div.F7nice span[aria-label*="reviews"]').first
                reviews_text = await reviews_elem.inner_text(timeout=2000)
                business_data['reviews'] = re.sub(r'[^\d]', '', reviews_text)
            except:
                pass
            
            # Extract address
            try:
                address_elem = page.locator('button[data-item-id="address"]')
                business_data['address'] = await address_elem.inner_text(timeout=2000)
            except:
                pass
            
            # Extract phone
            try:
                phone_elem = page.locator('button[data-item-id*="phone"]')
                business_data['phone'] = await phone_elem.inner_text(timeout=2000)
            except:
                pass
            
            # Extract website
            try:
                website_elem = page.locator('a[data-item-id="authority"]')
                business_data['website'] = await website_elem.get_attribute('href', timeout=2000)
            except:
                pass
            
            # Extract Maps URL and coordinates
            try:
                current_url = page.url
                business_data['maps_url'] = current_url
                
                # Extract coordinates from URL
                coords_match = re.search(r'@(-?\d+\.\d+),(-?\d+\.\d+)', current_url)
                if coords_match:
                    business_data['latitude'] = coords_match.group(1)
                    business_data['longitude'] = coords_match.group(2)
            except:
                pass
            
            return business_data if business_data['name'] else None
            
        except Exception as e:
            logger.debug(f"Error in business extraction: {str(e)}")
            return None
