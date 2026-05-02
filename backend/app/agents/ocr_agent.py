"""
KadaiGPT - OCR & Bill Digitization Agent
AI-powered extraction from handwritten bills using Gemini Vision
"""

import base64
import json
import re
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass
from enum import Enum
import asyncio

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

from PIL import Image
import io


class ConfidenceLevel(Enum):
    HIGH = "high"      # > 90% - Auto-save
    MEDIUM = "medium"  # 70-90% - Highlight for review
    LOW = "low"        # < 70% - Manual verification required


@dataclass
class ExtractedItem:
    name: str
    quantity: float
    unit_price: float
    total: float
    confidence: float
    needs_review: bool = False
    original_text: Optional[str] = None


@dataclass
class OCRResult:
    success: bool
    raw_text: str
    extracted_items: List[ExtractedItem]
    extracted_total: Optional[float]
    extracted_date: Optional[str]
    overall_confidence: float
    confidence_level: ConfidenceLevel
    suggestions: List[str]
    processing_time_ms: int
    errors: List[str] = None


class OCRAgent:
    """
    📷 OCR & BILL DIGITIZATION AGENT
    
    Responsibilities:
    - Process handwritten bill images
    - Extract items, quantities, prices with confidence scores
    - Auto-validate totals (detect calculation errors)
    - Learn from user corrections over time
    - Support multiple languages (Hindi, Tamil, English, etc.)
    """
    
    def __init__(self, api_key: Optional[str] = None):
        self.agent_name = "OCRAgent"
        self.api_key = api_key
        self.model = None
        self.correction_history: List[Dict] = []
        self.learned_patterns: Dict[str, str] = {}  # Map messy text to correct product names
        
        if api_key and GEMINI_AVAILABLE:
            self._initialize_gemini()
    
    def _initialize_gemini(self):
        """Initialize Google Gemini for vision processing"""
        try:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
            print("✅ Gemini Vision initialized successfully")
        except Exception as e:
            print(f"❌ Failed to initialize Gemini: {e}")
            self.model = None
    
    async def process_handwritten_bill(
        self, 
        image_data: bytes,
        store_products: Optional[List[Dict]] = None,
        language_hint: str = "en"
    ) -> OCRResult:
        """
        🧠 MAIN PROCESSING: Extract data from handwritten bill image
        
        Args:
            image_data: Raw image bytes
            store_products: Optional list of known products for matching
            language_hint: Expected language (en, hi, ta, te, etc.)
        
        Returns:
            OCRResult with extracted items and confidence scores
        """
        start_time = datetime.now()
        errors = []
        
        try:
            # Step 1: Validate and preprocess image
            processed_image = await self._preprocess_image(image_data)
            
            # Step 2: Extract text using Gemini Vision
            if self.model:
                raw_text, items, total, date_str = await self._gemini_extract(
                    processed_image, 
                    language_hint
                )
            else:
                # Fallback: Demo mode with simulated extraction
                raw_text, items, total, date_str = await self._demo_extract(processed_image)
            
            # Step 3: Apply learned corrections
            items = self._apply_learned_patterns(items)
            
            # Step 4: Match with store products if available
            if store_products:
                items = self._match_products(items, store_products)
            
            # Step 5: Validate extracted data
            validation_result = self._validate_extraction(items, total)
            
            # Step 6: Calculate overall confidence
            overall_confidence = self._calculate_confidence(items, validation_result)
            confidence_level = self._get_confidence_level(overall_confidence)
            
            # Step 7: Generate suggestions
            suggestions = self._generate_suggestions(items, validation_result)
            
            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
            
            return OCRResult(
                success=True,
                raw_text=raw_text,
                extracted_items=items,
                extracted_total=total,
                extracted_date=date_str,
                overall_confidence=overall_confidence,
                confidence_level=confidence_level,
                suggestions=suggestions,
                processing_time_ms=processing_time,
                errors=errors
            )
            
        except Exception as e:
            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
            return OCRResult(
                success=False,
                raw_text="",
                extracted_items=[],
                extracted_total=None,
                extracted_date=None,
                overall_confidence=0.0,
                confidence_level=ConfidenceLevel.LOW,
                suggestions=["Processing failed. Please try again or enter manually."],
                processing_time_ms=processing_time,
                errors=[str(e)]
            )
    
    async def _preprocess_image(self, image_data: bytes) -> Image.Image:
        """Preprocess image for better OCR results"""
        image = Image.open(io.BytesIO(image_data))
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize if too large (for API limits)
        max_size = 2048
        if max(image.size) > max_size:
            ratio = max_size / max(image.size)
            new_size = (int(image.size[0] * ratio), int(image.size[1] * ratio))
            image = image.resize(new_size, Image.Resampling.LANCZOS)
        
        return image
    
    async def _gemini_extract(
        self, 
        image: Image.Image,
        language_hint: str
    ) -> Tuple[str, List[ExtractedItem], Optional[float], Optional[str]]:
        """Use Gemini Vision API for extraction"""
        
        # Convert image to bytes for API
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='JPEG', quality=85)
        img_bytes = img_byte_arr.getvalue()
        
        prompt = f"""Analyze this handwritten bill/receipt image and extract all information.
        
Language hint: {language_hint}

Please extract and return in this exact JSON format:
{{
    "raw_text": "Complete text visible in the image",
    "date": "Date if visible (DD/MM/YYYY format)",
    "items": [
        {{
            "name": "Product name",
            "quantity": 1.0,
            "unit_price": 0.0,
            "total": 0.0,
            "confidence": 0.95,
            "original_text": "Original text as written"
        }}
    ],
    "grand_total": 0.0
}}

Important:
1. Extract EVERY item visible, even if prices are unclear
2. For unclear values, make best guess and set lower confidence (0.5-0.7)
3. If you can't read something, set confidence below 0.5
4. Convert Hindi/regional numbers to Arabic numerals
5. Handle common abbreviations (kg, pcs, L, etc.)
6. Detect and flag calculation errors
"""
        
        try:
            response = self.model.generate_content([prompt, image])
            response_text = response.text
            
            # Extract JSON from response
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                data = json.loads(json_match.group())
                
                items = []
                for item in data.get('items', []):
                    items.append(ExtractedItem(
                        name=item.get('name', 'Unknown'),
                        quantity=float(item.get('quantity', 1)),
                        unit_price=float(item.get('unit_price', 0)),
                        total=float(item.get('total', 0)),
                        confidence=float(item.get('confidence', 0.5)),
                        needs_review=item.get('confidence', 0.5) < 0.8,
                        original_text=item.get('original_text')
                    ))
                
                return (
                    data.get('raw_text', ''),
                    items,
                    data.get('grand_total'),
                    data.get('date')
                )
                
        except Exception as e:
            print(f"Gemini extraction error: {e}")
        
        return "", [], None, None
    
    async def _demo_extract(
        self, 
        image: Image.Image
    ) -> Tuple[str, List[ExtractedItem], Optional[float], Optional[str]]:
        """Demo extraction when Gemini is not available"""
        
        # Simulate processing delay
        await asyncio.sleep(0.5)
        
        # Return demo data
        demo_items = [
            ExtractedItem(
                name="Rice (Basmati)",
                quantity=2,
                unit_price=85.00,
                total=170.00,
                confidence=0.92,
                original_text="Rice 2kg - 170"
            ),
            ExtractedItem(
                name="Dal (Toor)",
                quantity=1,
                unit_price=140.00,
                total=140.00,
                confidence=0.88,
                needs_review=False,
                original_text="Toor Dal 1kg - 140"
            ),
            ExtractedItem(
                name="Sugar",
                quantity=2,
                unit_price=45.00,
                total=90.00,
                confidence=0.95,
                original_text="Sugar 2kg - 90"
            ),
            ExtractedItem(
                name="Cooking Oil",
                quantity=1,
                unit_price=180.00,
                total=180.00,
                confidence=0.85,
                needs_review=True,
                original_text="Oil 1L - 180"
            ),
            ExtractedItem(
                name="Salt",
                quantity=1,
                unit_price=20.00,
                total=20.00,
                confidence=0.97,
                original_text="Salt 1kg - 20"
            )
        ]
        
        raw_text = """Hand Written Bill
Date: 29/01/2026

Rice 2kg     170
Toor Dal 1kg  140
Sugar 2kg      90
Oil 1L        180
Salt 1kg       20
-----------------
Total:        600"""
        
        return raw_text, demo_items, 600.00, "29/01/2026"
    
    def _apply_learned_patterns(self, items: List[ExtractedItem]) -> List[ExtractedItem]:
        """Apply previously learned corrections to improve accuracy"""
        for item in items:
            # Check if we've seen this messy text before
            if item.original_text and item.original_text.lower() in self.learned_patterns:
                corrected_name = self.learned_patterns[item.original_text.lower()]
                item.name = corrected_name
                item.confidence = min(1.0, item.confidence + 0.1)  # Boost confidence
                item.needs_review = False
        
        return items
    
    def _match_products(
        self, 
        items: List[ExtractedItem],
        store_products: List[Dict]
    ) -> List[ExtractedItem]:
        """Match extracted items with known store products"""
        for item in items:
            best_match = None
            best_score = 0.0
            
            for product in store_products:
                # Simple fuzzy matching
                score = self._similarity_score(item.name, product.get('name', ''))
                if score > best_score and score > 0.6:
                    best_score = score
                    best_match = product
            
            if best_match:
                item.name = best_match['name']
                item.confidence = min(1.0, item.confidence + 0.15)
        
        return items
    
    def _similarity_score(self, str1: str, str2: str) -> float:
        """Calculate simple similarity score between two strings"""
        str1 = str1.lower().strip()
        str2 = str2.lower().strip()
        
        if str1 == str2:
            return 1.0
        
        # Check if one contains the other
        if str1 in str2 or str2 in str1:
            return 0.8
        
        # Calculate word overlap
        words1 = set(str1.split())
        words2 = set(str2.split())
        
        if not words1 or not words2:
            return 0.0
        
        overlap = len(words1.intersection(words2))
        return overlap / max(len(words1), len(words2))
    
    def _validate_extraction(
        self, 
        items: List[ExtractedItem],
        extracted_total: Optional[float]
    ) -> Dict[str, Any]:
        """Validate extracted data for consistency"""
        result = {
            "valid": True,
            "issues": []
        }
        
        if not items:
            result["valid"] = False
            result["issues"].append("No items extracted")
            return result
        
        # Calculate sum of item totals
        calculated_total = sum(item.total for item in items)
        
        # Check individual item calculations
        for i, item in enumerate(items):
            expected_total = item.quantity * item.unit_price
            if abs(expected_total - item.total) > 0.01:
                result["issues"].append(
                    f"Item '{item.name}': {item.quantity} × ₹{item.unit_price} = ₹{expected_total}, not ₹{item.total}"
                )
        
        # Check grand total
        if extracted_total is not None:
            if abs(calculated_total - extracted_total) > 1.0:
                result["issues"].append(
                    f"Total mismatch: Items sum to ₹{calculated_total:.2f}, but bill shows ₹{extracted_total:.2f}"
                )
                result["valid"] = False
        
        return result
    
    def _calculate_confidence(
        self, 
        items: List[ExtractedItem],
        validation_result: Dict
    ) -> float:
        """Calculate overall confidence score"""
        if not items:
            return 0.0
        
        # Average item confidence
        avg_confidence = sum(item.confidence for item in items) / len(items)
        
        # Penalty for validation issues
        penalty = len(validation_result.get("issues", [])) * 0.1
        
        # Final score
        overall = max(0.0, avg_confidence - penalty)
        
        return round(overall, 2)
    
    def _get_confidence_level(self, confidence: float) -> ConfidenceLevel:
        """Map confidence score to level"""
        if confidence >= 0.9:
            return ConfidenceLevel.HIGH
        elif confidence >= 0.7:
            return ConfidenceLevel.MEDIUM
        else:
            return ConfidenceLevel.LOW
    
    def _generate_suggestions(
        self, 
        items: List[ExtractedItem],
        validation_result: Dict
    ) -> List[str]:
        """Generate helpful suggestions for the user"""
        suggestions = []
        
        # Items needing review
        review_items = [item.name for item in items if item.needs_review]
        if review_items:
            suggestions.append(f"Please verify: {', '.join(review_items[:3])}")
        
        # Validation issues
        for issue in validation_result.get("issues", [])[:2]:
            suggestions.append(f"⚠️ {issue}")
        
        # Low confidence items
        low_conf = [item for item in items if item.confidence < 0.6]
        if low_conf:
            suggestions.append("Some items have low confidence. Consider manual verification.")
        
        if not suggestions:
            suggestions.append("✅ High confidence extraction. Ready to save!")
        
        return suggestions
    
    def learn_from_correction(
        self, 
        original_text: str,
        corrected_name: str
    ):
        """Learn from user corrections to improve future accuracy"""
        if original_text and corrected_name:
            self.learned_patterns[original_text.lower()] = corrected_name
            self.correction_history.append({
                "timestamp": datetime.now().isoformat(),
                "original": original_text,
                "corrected": corrected_name
            })
            print(f"🧠 Learned: '{original_text}' → '{corrected_name}'")
    
    def get_agent_stats(self) -> Dict[str, Any]:
        """Get agent performance statistics"""
        return {
            "agent_name": self.agent_name,
            "learned_patterns_count": len(self.learned_patterns),
            "total_corrections": len(self.correction_history),
            "gemini_available": self.model is not None
        }


# Singleton instance
ocr_agent = OCRAgent()
