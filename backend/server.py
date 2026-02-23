from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import json
import io
import csv
import asyncio
import httpx
import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sentence_transformers import SentenceTransformer
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="ReviewSense AI API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Sentence Transformer model (lightweight model)
sentence_model = None

def get_sentence_model():
    global sentence_model
    if sentence_model is None:
        logger.info("Loading Sentence Transformer model...")
        sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
        logger.info("Sentence Transformer model loaded")
    return sentence_model

# Pydantic Models
class Review(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    review_text: str
    rating: Optional[float] = None
    sentiment: Optional[str] = None
    topic: Optional[str] = None
    cluster_id: Optional[int] = None
    embedding: Optional[List[float]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReviewCreate(BaseModel):
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    review_text: str
    rating: Optional[float] = None

class Dataset(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    total_reviews: int = 0
    processed_reviews: int = 0
    status: str = "pending"  # pending, processing, completed, failed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ClusterInfo(BaseModel):
    cluster_id: int
    size: int
    label: Optional[str] = None
    keywords: List[str] = []
    sample_reviews: List[str] = []
    centroid: Optional[List[float]] = None

class InsightResponse(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    summary: str
    category: str
    priority: str
    affected_reviews: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SearchRequest(BaseModel):
    query: str
    top_k: int = 10
    use_openai: bool = False

class SlackConfig(BaseModel):
    webhook_url: str
    enabled: bool = True

class SummarizationRequest(BaseModel):
    review_ids: Optional[List[str]] = None
    cluster_id: Optional[int] = None
    topic: Optional[str] = None

# Sample Amazon Review Data
SAMPLE_REVIEWS = [
    {"product_name": "Wireless Bluetooth Headphones", "review_text": "Great sound quality but the battery drains too fast. Had to charge it twice a day with heavy use.", "rating": 3.0},
    {"product_name": "Wireless Bluetooth Headphones", "review_text": "Excellent noise cancellation! Perfect for my work from home setup. Very comfortable for long hours.", "rating": 5.0},
    {"product_name": "Wireless Bluetooth Headphones", "review_text": "The Bluetooth connection keeps dropping every few minutes. Very frustrating experience.", "rating": 2.0},
    {"product_name": "Wireless Bluetooth Headphones", "review_text": "Comfortable fit and good audio. The app could use some improvement but overall satisfied.", "rating": 4.0},
    {"product_name": "Smart Watch Series X", "review_text": "Battery life is disappointing. Barely lasts a day with normal usage. Screen is beautiful though.", "rating": 3.0},
    {"product_name": "Smart Watch Series X", "review_text": "Love the fitness tracking features! Accurate heart rate monitoring and sleep tracking.", "rating": 5.0},
    {"product_name": "Smart Watch Series X", "review_text": "The watch keeps disconnecting from my phone. Customer support was unhelpful.", "rating": 1.0},
    {"product_name": "Smart Watch Series X", "review_text": "Great design and comfortable. Notifications work flawlessly. Worth the price.", "rating": 4.0},
    {"product_name": "Portable Laptop Stand", "review_text": "Sturdy build and perfect height adjustment. My neck pain has reduced significantly.", "rating": 5.0},
    {"product_name": "Portable Laptop Stand", "review_text": "The hinges broke after 2 weeks of use. Very poor quality materials.", "rating": 1.0},
    {"product_name": "Portable Laptop Stand", "review_text": "Good value for money. Easy to fold and carry. Slight wobble but manageable.", "rating": 4.0},
    {"product_name": "USB-C Hub Adapter", "review_text": "All ports work perfectly. Finally found a hub that doesn't overheat!", "rating": 5.0},
    {"product_name": "USB-C Hub Adapter", "review_text": "The HDMI port stopped working after a month. No response from seller for replacement.", "rating": 1.0},
    {"product_name": "USB-C Hub Adapter", "review_text": "Compact design but gets warm during extended use. Works well otherwise.", "rating": 3.0},
    {"product_name": "Mechanical Keyboard RGB", "review_text": "Typing experience is amazing! The switches feel premium and RGB is customizable.", "rating": 5.0},
    {"product_name": "Mechanical Keyboard RGB", "review_text": "Too loud for office use. Great for gaming but not practical for work.", "rating": 3.0},
    {"product_name": "Mechanical Keyboard RGB", "review_text": "Several keys stopped responding within a week. Terrible quality control.", "rating": 1.0},
    {"product_name": "Wireless Mouse Pro", "review_text": "Perfect ergonomic design. No more wrist pain after switching to this mouse.", "rating": 5.0},
    {"product_name": "Wireless Mouse Pro", "review_text": "The scroll wheel is too sensitive. Accidentally scrolls past content all the time.", "rating": 2.0},
    {"product_name": "Wireless Mouse Pro", "review_text": "Good tracking and responsive. Battery lasts about 3 months. Recommended.", "rating": 4.0},
    {"product_name": "Smart Home Speaker", "review_text": "Voice recognition is impressive! Controls all my smart devices seamlessly.", "rating": 5.0},
    {"product_name": "Smart Home Speaker", "review_text": "Privacy concerns aside, the sound quality for music is mediocre at best.", "rating": 3.0},
    {"product_name": "Smart Home Speaker", "review_text": "Keeps mishearing commands. Had to repeat myself multiple times for simple tasks.", "rating": 2.0},
    {"product_name": "Webcam HD 1080p", "review_text": "Crystal clear video quality for meetings. Auto-focus works great in all lighting.", "rating": 5.0},
    {"product_name": "Webcam HD 1080p", "review_text": "The microphone picks up too much background noise. Had to use external mic.", "rating": 3.0},
    {"product_name": "External SSD 1TB", "review_text": "Blazing fast transfer speeds! Perfect for video editing workflow.", "rating": 5.0},
    {"product_name": "External SSD 1TB", "review_text": "Drive failed after 3 months. Lost important data. Very unreliable.", "rating": 1.0},
    {"product_name": "External SSD 1TB", "review_text": "Good performance for the price. Compact and portable. No complaints.", "rating": 4.0},
    {"product_name": "Desk LED Lamp", "review_text": "Multiple brightness levels are great. Eye-friendly light for late night work.", "rating": 5.0},
    {"product_name": "Desk LED Lamp", "review_text": "The touch controls are finicky. Sometimes doesn't respond to touch.", "rating": 3.0},
    {"product_name": "Wireless Charger Pad", "review_text": "Charges my phone quickly and quietly. No overheating issues so far.", "rating": 5.0},
    {"product_name": "Wireless Charger Pad", "review_text": "Phone has to be positioned perfectly or it won't charge. Very annoying.", "rating": 2.0},
    {"product_name": "Noise Canceling Earbuds", "review_text": "The ANC is phenomenal! Blocks out all office noise. Great for focus.", "rating": 5.0},
    {"product_name": "Noise Canceling Earbuds", "review_text": "Uncomfortable after an hour of use. The ear tips don't seal properly.", "rating": 2.0},
    {"product_name": "Noise Canceling Earbuds", "review_text": "Good sound but the case is bulky. Touch controls are responsive.", "rating": 4.0},
    {"product_name": "Monitor Arm Mount", "review_text": "Freed up so much desk space! Very sturdy and adjustable.", "rating": 5.0},
    {"product_name": "Monitor Arm Mount", "review_text": "Installation was a nightmare. Instructions are unclear and missing parts.", "rating": 2.0},
    {"product_name": "Ergonomic Office Chair", "review_text": "Best investment for my home office. Lumbar support is fantastic!", "rating": 5.0},
    {"product_name": "Ergonomic Office Chair", "review_text": "Chair arrived damaged. Replacement process took over a month.", "rating": 1.0},
    {"product_name": "Ergonomic Office Chair", "review_text": "Comfortable but armrests are wobbly. Good value overall.", "rating": 3.0},
]

# Topic categories for classification
TOPIC_CATEGORIES = [
    "Battery & Power",
    "Connectivity Issues",
    "Build Quality",
    "Comfort & Ergonomics",
    "Performance",
    "Customer Service",
    "Value for Money",
    "Software & Features",
    "Design & Aesthetics",
    "Reliability"
]

# Utility Functions
def classify_sentiment(rating: float) -> str:
    if rating >= 4:
        return "positive"
    elif rating >= 3:
        return "neutral"
    return "negative"

def classify_topic(review_text: str) -> str:
    text_lower = review_text.lower()
    
    if any(word in text_lower for word in ["battery", "charge", "power", "drain"]):
        return "Battery & Power"
    elif any(word in text_lower for word in ["bluetooth", "connect", "disconnect", "wifi", "signal"]):
        return "Connectivity Issues"
    elif any(word in text_lower for word in ["broke", "break", "quality", "material", "sturdy", "flimsy"]):
        return "Build Quality"
    elif any(word in text_lower for word in ["comfortable", "ergonomic", "pain", "fit", "wear"]):
        return "Comfort & Ergonomics"
    elif any(word in text_lower for word in ["fast", "slow", "speed", "performance", "responsive"]):
        return "Performance"
    elif any(word in text_lower for word in ["support", "customer", "service", "response", "replacement"]):
        return "Customer Service"
    elif any(word in text_lower for word in ["price", "value", "worth", "expensive", "cheap"]):
        return "Value for Money"
    elif any(word in text_lower for word in ["app", "software", "feature", "update", "control"]):
        return "Software & Features"
    elif any(word in text_lower for word in ["design", "look", "aesthetic", "beautiful", "ugly"]):
        return "Design & Aesthetics"
    else:
        return "Reliability"

async def generate_embeddings_sentence_transformer(texts: List[str]) -> List[List[float]]:
    """Generate embeddings using Sentence Transformers (local, no API cost)"""
    model = get_sentence_model()
    embeddings = model.encode(texts, convert_to_numpy=True)
    return embeddings.tolist()

async def summarize_with_openai(texts: List[str], context: str = "") -> str:
    """Generate summary using OPEN AI GPT 4.0 Models via OPENAI_API_KEY"""
    try:
        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            return "Summary generation unavailable - API key not configured"
        
        # Limit text to avoid timeout
        combined_text = "\n\n".join(texts[:10])  # Limit to 10 reviews to speed up
        if len(combined_text) > 4000:
            combined_text = combined_text[:4000] + "..."
        
        chat_instance = ChatOpenAI(
        model="gpt-4o",   # or gpt-4.1
        api_key=OPENAI_API_KEY,
        temperature=0.7
         )

        messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt)
         ]  
        
        prompt = f"""Analyze these customer reviews and provide a brief summary (max 200 words):
- Main themes
- Key issues
- Recommendations

Context: {context}

Reviews:
{combined_text}"""

        response = await chat_instance.ainvoke(messages)
        response_text = response.content
        return response_text
        
    except Exception as e:
        logger.error(f"Open AI summarization error: {e}")
        return f"Summary generation failed: {str(e)}"

async def send_slack_notification(webhook_url: str, message: dict) -> bool:
    """Send notification to Slack webhook"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(webhook_url, json=message)
            return response.status_code == 200
    except Exception as e:
        logger.error(f"Slack notification error: {e}")
        return False

# API Endpoints

@api_router.get("/")
async def root():
    return {"message": "ReviewSense AI API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Dataset Management
@api_router.post("/datasets/sample")
async def load_sample_dataset():
    """Load sample Amazon review data"""
    try:
        # Clear existing reviews
        await db.reviews.delete_many({})
        
        # Create dataset record
        dataset = Dataset(
            name="Sample Amazon Reviews",
            total_reviews=len(SAMPLE_REVIEWS),
            status="processing"
        )
        dataset_dict = dataset.model_dump()
        dataset_dict['created_at'] = dataset_dict['created_at'].isoformat()
        await db.datasets.insert_one(dataset_dict)
        
        # Process and insert reviews
        reviews_to_insert = []
        review_texts = [r["review_text"] for r in SAMPLE_REVIEWS]
        
        # Generate embeddings
        embeddings = await generate_embeddings_sentence_transformer(review_texts)
        
        for idx, sample in enumerate(SAMPLE_REVIEWS):
            review = Review(
                product_name=sample["product_name"],
                review_text=sample["review_text"],
                rating=sample["rating"],
                sentiment=classify_sentiment(sample["rating"]),
                topic=classify_topic(sample["review_text"]),
                embedding=embeddings[idx]
            )
            review_dict = review.model_dump()
            review_dict['created_at'] = review_dict['created_at'].isoformat()
            reviews_to_insert.append(review_dict)
        
        await db.reviews.insert_many(reviews_to_insert)
        
        # Update dataset status
        await db.datasets.update_one(
            {"id": dataset.id},
            {"$set": {"status": "completed", "processed_reviews": len(SAMPLE_REVIEWS)}}
        )
        
        return {"message": "Sample dataset loaded", "total_reviews": len(SAMPLE_REVIEWS), "dataset_id": dataset.id}
    except Exception as e:
        logger.error(f"Error loading sample dataset: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)):
    """Upload CSV dataset"""
    try:
        content = await file.read()
        decoded = content.decode('utf-8')
        reader = csv.DictReader(io.StringIO(decoded))
        
        reviews_data = []
        for row in reader:
            review_text = row.get('review_text') or row.get('reviewText') or row.get('text') or row.get('review')
            rating = row.get('rating') or row.get('overall') or row.get('score')
            product = row.get('product_name') or row.get('productName') or row.get('asin')
            
            if review_text:
                reviews_data.append({
                    "product_name": product,
                    "review_text": review_text,
                    "rating": float(rating) if rating else 3.0
                })
        
        if not reviews_data:
            raise HTTPException(status_code=400, detail="No valid reviews found in CSV")
        
        # Create dataset record
        dataset = Dataset(
            name=file.filename,
            total_reviews=len(reviews_data),
            status="processing"
        )
        dataset_dict = dataset.model_dump()
        dataset_dict['created_at'] = dataset_dict['created_at'].isoformat()
        await db.datasets.insert_one(dataset_dict)
        
        # Process reviews in batches
        batch_size = 100
        reviews_to_insert = []
        
        for i in range(0, len(reviews_data), batch_size):
            batch = reviews_data[i:i + batch_size]
            review_texts = [r["review_text"] for r in batch]
            
            embeddings = await generate_embeddings_sentence_transformer(review_texts)
            
            for idx, data in enumerate(batch):
                review = Review(
                    product_name=data["product_name"],
                    review_text=data["review_text"],
                    rating=data["rating"],
                    sentiment=classify_sentiment(data["rating"]),
                    topic=classify_topic(data["review_text"]),
                    embedding=embeddings[idx]
                )
                review_dict = review.model_dump()
                review_dict['created_at'] = review_dict['created_at'].isoformat()
                reviews_to_insert.append(review_dict)
        
        await db.reviews.insert_many(reviews_to_insert)
        
        await db.datasets.update_one(
            {"id": dataset.id},
            {"$set": {"status": "completed", "processed_reviews": len(reviews_data)}}
        )
        
        return {"message": "Dataset uploaded", "total_reviews": len(reviews_data), "dataset_id": dataset.id}
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/datasets")
async def get_datasets():
    """Get all datasets"""
    datasets = await db.datasets.find({}, {"_id": 0}).to_list(100)
    return datasets

# Review Management
@api_router.get("/reviews")
async def get_reviews(limit: int = 100, offset: int = 0, topic: Optional[str] = None, sentiment: Optional[str] = None):
    """Get reviews with optional filters"""
    query = {}
    if topic:
        query["topic"] = topic
    if sentiment:
        query["sentiment"] = sentiment
    
    reviews = await db.reviews.find(query, {"_id": 0, "embedding": 0}).skip(offset).limit(limit).to_list(limit)
    total = await db.reviews.count_documents(query)
    
    return {"reviews": reviews, "total": total, "limit": limit, "offset": offset}

@api_router.get("/reviews/{review_id}")
async def get_review(review_id: str):
    """Get single review by ID"""
    review = await db.reviews.find_one({"id": review_id}, {"_id": 0, "embedding": 0})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return review

# Analytics & Statistics
@api_router.get("/analytics/overview")
async def get_analytics_overview():
    """Get dashboard overview statistics"""
    total_reviews = await db.reviews.count_documents({})
    
    sentiment_pipeline = [
        {"$group": {"_id": "$sentiment", "count": {"$sum": 1}}}
    ]
    sentiment_dist = await db.reviews.aggregate(sentiment_pipeline).to_list(10)
    
    topic_pipeline = [
        {"$group": {"_id": "$topic", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    topic_dist = await db.reviews.aggregate(topic_pipeline).to_list(20)
    
    rating_pipeline = [
        {"$group": {"_id": None, "avg_rating": {"$avg": "$rating"}}}
    ]
    avg_rating_result = await db.reviews.aggregate(rating_pipeline).to_list(1)
    avg_rating = avg_rating_result[0]["avg_rating"] if avg_rating_result else 0
    
    product_pipeline = [
        {"$group": {"_id": "$product_name", "count": {"$sum": 1}, "avg_rating": {"$avg": "$rating"}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    top_products = await db.reviews.aggregate(product_pipeline).to_list(10)
    
    return {
        "total_reviews": total_reviews,
        "sentiment_distribution": {item["_id"]: item["count"] for item in sentiment_dist if item["_id"]},
        "topic_distribution": [{"topic": item["_id"], "count": item["count"]} for item in topic_dist if item["_id"]],
        "average_rating": round(avg_rating, 2) if avg_rating else 0,
        "top_products": [{"product": item["_id"], "reviews": item["count"], "avg_rating": round(item["avg_rating"], 2)} for item in top_products if item["_id"]]
    }

# Clustering
@api_router.post("/clustering/run")
async def run_clustering(n_clusters: int = 5):
    """Run K-means clustering on review embeddings"""
    try:
        reviews = await db.reviews.find({"embedding": {"$exists": True}}, {"_id": 0}).to_list(10000)
        
        if len(reviews) < n_clusters:
            raise HTTPException(status_code=400, detail=f"Need at least {n_clusters} reviews for clustering")
        
        embeddings = np.array([r["embedding"] for r in reviews])
        
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(embeddings)
        
        # Calculate silhouette score
        silhouette = silhouette_score(embeddings, labels) if len(set(labels)) > 1 else 0
        
        # Update reviews with cluster assignments
        for idx, review in enumerate(reviews):
            await db.reviews.update_one(
                {"id": review["id"]},
                {"$set": {"cluster_id": int(labels[idx])}}
            )
        
        # Generate cluster info
        clusters = []
        for cluster_id in range(n_clusters):
            cluster_indices = np.where(labels == cluster_id)[0]
            cluster_reviews = [reviews[i] for i in cluster_indices]
            
            # Get most common topic in cluster
            topics = [r.get("topic", "Unknown") for r in cluster_reviews]
            topic_counts = {}
            for t in topics:
                topic_counts[t] = topic_counts.get(t, 0) + 1
            dominant_topic = max(topic_counts, key=topic_counts.get) if topic_counts else "Unknown"
            
            clusters.append({
                "cluster_id": cluster_id,
                "size": len(cluster_reviews),
                "label": dominant_topic,
                "sample_reviews": [r["review_text"][:100] + "..." for r in cluster_reviews[:3]],
                "sentiment_breakdown": {
                    "positive": sum(1 for r in cluster_reviews if r.get("sentiment") == "positive"),
                    "neutral": sum(1 for r in cluster_reviews if r.get("sentiment") == "neutral"),
                    "negative": sum(1 for r in cluster_reviews if r.get("sentiment") == "negative")
                }
            })
        
        # Store clustering results
        clustering_result = {
            "id": str(uuid.uuid4()),
            "n_clusters": n_clusters,
            "silhouette_score": float(silhouette),
            "clusters": clusters,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.clustering_results.insert_one(clustering_result)
        
        # Return without MongoDB _id
        return {
            "id": clustering_result["id"],
            "n_clusters": clustering_result["n_clusters"],
            "silhouette_score": clustering_result["silhouette_score"],
            "clusters": clustering_result["clusters"],
            "created_at": clustering_result["created_at"]
        }
    except Exception as e:
        logger.error(f"Clustering error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/clustering/results")
async def get_clustering_results():
    """Get latest clustering results"""
    result = await db.clustering_results.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    if not result:
        return {"message": "No clustering results found. Run clustering first."}
    return result

@api_router.get("/clustering/scatter-data")
async def get_scatter_data():
    """Get 2D scatter data for visualization (using first 2 PCA components)"""
    reviews = await db.reviews.find(
        {"embedding": {"$exists": True}, "cluster_id": {"$exists": True}},
        {"_id": 0, "id": 1, "review_text": 1, "cluster_id": 1, "sentiment": 1, "topic": 1, "rating": 1, "embedding": 1}
    ).to_list(500)
    
    if len(reviews) < 2:
        return {"data": []}
    
    embeddings = np.array([r["embedding"] for r in reviews])
    
    # Simple PCA-like dimensionality reduction using SVD
    mean = np.mean(embeddings, axis=0)
    centered = embeddings - mean
    U, S, Vt = np.linalg.svd(centered, full_matrices=False)
    reduced = U[:, :2] * S[:2]
    
    # Normalize to 0-100 range for visualization
    x_min, x_max = reduced[:, 0].min(), reduced[:, 0].max()
    y_min, y_max = reduced[:, 1].min(), reduced[:, 1].max()
    
    scatter_data = []
    for idx, review in enumerate(reviews):
        x = ((reduced[idx, 0] - x_min) / (x_max - x_min) * 100) if x_max > x_min else 50
        y = ((reduced[idx, 1] - y_min) / (y_max - y_min) * 100) if y_max > y_min else 50
        scatter_data.append({
            "id": review["id"],
            "x": float(x),
            "y": float(y),
            "cluster_id": review.get("cluster_id", 0),
            "sentiment": review.get("sentiment", "neutral"),
            "topic": review.get("topic", "Unknown"),
            "rating": review.get("rating", 3),
            "text": review["review_text"][:80] + "..." if len(review["review_text"]) > 80 else review["review_text"]
        })
    
    return {"data": scatter_data}

# Semantic Search
@api_router.post("/search")
async def semantic_search(request: SearchRequest):
    """Perform semantic search across reviews"""
    try:
        # Generate query embedding
        query_embedding = await generate_embeddings_sentence_transformer([request.query])
        query_vec = np.array(query_embedding[0])
        
        # Get all reviews with embeddings
        reviews = await db.reviews.find({"embedding": {"$exists": True}}, {"_id": 0}).to_list(10000)
        
        if not reviews:
            return {"results": [], "query": request.query}
        
        # Calculate cosine similarities
        similarities = []
        for review in reviews:
            review_vec = np.array(review["embedding"])
            similarity = np.dot(query_vec, review_vec) / (np.linalg.norm(query_vec) * np.linalg.norm(review_vec))
            similarities.append((review, float(similarity)))
        
        # Sort by similarity and return top_k
        similarities.sort(key=lambda x: x[1], reverse=True)
        top_results = similarities[:request.top_k]
        
        results = []
        for review, score in top_results:
            results.append({
                "id": review["id"],
                "review_text": review["review_text"],
                "product_name": review.get("product_name"),
                "rating": review.get("rating"),
                "sentiment": review.get("sentiment"),
                "topic": review.get("topic"),
                "similarity_score": round(score, 4)
            })
        
        return {"results": results, "query": request.query, "total_searched": len(reviews)}
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Insights & Summarization
@api_router.post("/insights/generate")
async def generate_insights(request: SummarizationRequest):
    """Generate AI-powered insights from reviews"""
    try:
        query = {}
        context = "General review analysis"
        
        if request.cluster_id is not None:
            query["cluster_id"] = request.cluster_id
            context = f"Cluster {request.cluster_id} analysis"
        elif request.topic:
            query["topic"] = request.topic
            context = f"Topic: {request.topic} analysis"
        elif request.review_ids:
            query["id"] = {"$in": request.review_ids}
            context = "Selected reviews analysis"
        
        reviews = await db.reviews.find(query, {"_id": 0, "embedding": 0}).to_list(50)
        
        if not reviews:
            return {"error": "No reviews found matching criteria"}
        
        review_texts = [r["review_text"] for r in reviews]
        summary = await summarize_with_openai(review_texts, context)
        
        # Create insight record
        insight = InsightResponse(
            title=f"Insight: {context}",
            summary=summary,
            category=context,
            priority="high" if any(r.get("sentiment") == "negative" for r in reviews) else "medium",
            affected_reviews=len(reviews)
        )
        
        insight_dict = insight.model_dump()
        insight_dict['created_at'] = insight_dict['created_at'].isoformat()
        await db.insights.insert_one(insight_dict)
        
        # Return without MongoDB _id
        return {
            "id": insight_dict["id"],
            "title": insight_dict["title"],
            "summary": insight_dict["summary"],
            "category": insight_dict["category"],
            "priority": insight_dict["priority"],
            "affected_reviews": insight_dict["affected_reviews"],
            "created_at": insight_dict["created_at"]
        }
    except Exception as e:
        logger.error(f"Insight generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/insights")
async def get_insights(limit: int = 20):
    """Get generated insights"""
    insights = await db.insights.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"insights": insights}

@api_router.post("/insights/recurring-issues")
async def identify_recurring_issues():
    """Identify recurring issues from negative reviews"""
    try:
        negative_reviews = await db.reviews.find(
            {"sentiment": "negative"},
            {"_id": 0, "embedding": 0}
        ).to_list(100)
        
        if len(negative_reviews) < 3:
            return {"issues": [], "message": "Not enough negative reviews for analysis"}
        
        # Group by topic
        topic_issues = {}
        for review in negative_reviews:
            topic = review.get("topic", "Unknown")
            if topic not in topic_issues:
                topic_issues[topic] = []
            topic_issues[topic].append(review)
        
        issues = []
        for topic, reviews in topic_issues.items():
            if len(reviews) >= 2:  # At least 2 reviews for a recurring issue
                review_texts = [r["review_text"] for r in reviews[:10]]
                summary = await summarize_with_openai(review_texts, f"Recurring issue: {topic}")
                
                issues.append({
                    "topic": topic,
                    "count": len(reviews),
                    "summary": summary,
                    "sample_reviews": [r["review_text"][:100] for r in reviews[:3]],
                    "products_affected": list(set(r.get("product_name") for r in reviews if r.get("product_name")))
                })
        
        issues.sort(key=lambda x: x["count"], reverse=True)
        
        return {"issues": issues, "total_negative_reviews": len(negative_reviews)}
    except Exception as e:
        logger.error(f"Recurring issues error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Slack Integration
@api_router.post("/slack/configure")
async def configure_slack(config: SlackConfig):
    """Configure Slack webhook"""
    config_dict = config.model_dump()
    config_dict["configured_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.settings.update_one(
        {"type": "slack"},
        {"$set": config_dict},
        upsert=True
    )
    
    return {"message": "Slack configured successfully"}

@api_router.get("/slack/config")
async def get_slack_config():
    """Get Slack configuration"""
    config = await db.settings.find_one({"type": "slack"}, {"_id": 0})
    return config or {"enabled": False, "webhook_url": ""}

@api_router.post("/slack/send-alert")
async def send_slack_alert(title: str, message: str):
    """Send alert to Slack"""
    config = await db.settings.find_one({"type": "slack"})
    
    if not config or not config.get("enabled") or not config.get("webhook_url"):
        raise HTTPException(status_code=400, detail="Slack not configured")
    
    slack_message = {
        "blocks": [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"🔔 {title}"}
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": message}
            },
            {
                "type": "context",
                "elements": [{"type": "mrkdwn", "text": f"Sent from ReviewSense AI | {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"}]
            }
        ]
    }
    
    success = await send_slack_notification(config["webhook_url"], slack_message)
    
    if success:
        return {"message": "Alert sent successfully"}
    raise HTTPException(status_code=500, detail="Failed to send Slack alert")

# Export
@api_router.get("/export/csv")
async def export_reviews_csv(topic: Optional[str] = None, sentiment: Optional[str] = None):
    """Export reviews to CSV"""
    query = {}
    if topic:
        query["topic"] = topic
    if sentiment:
        query["sentiment"] = sentiment
    
    reviews = await db.reviews.find(query, {"_id": 0, "embedding": 0}).to_list(10000)
    
    output = io.StringIO()
    if reviews:
        writer = csv.DictWriter(output, fieldnames=reviews[0].keys())
        writer.writeheader()
        writer.writerows(reviews)
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=reviews_export.csv"}
    )

@api_router.get("/export/insights-csv")
async def export_insights_csv():
    """Export insights to CSV"""
    insights = await db.insights.find({}, {"_id": 0}).to_list(1000)
    
    output = io.StringIO()
    if insights:
        writer = csv.DictWriter(output, fieldnames=insights[0].keys())
        writer.writeheader()
        writer.writerows(insights)
    
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=insights_export.csv"}
    )

# PDF Export using ReportLab
@api_router.get("/export/pdf")
async def export_report_pdf():
    """Export analytics report as PDF"""
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    from reportlab.lib.units import inch
    
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    # Title
    c.setFont("Helvetica-Bold", 24)
    c.drawString(1*inch, height - 1*inch, "ReviewSense AI - Analytics Report")
    
    # Get analytics data
    total_reviews = await db.reviews.count_documents({})
    sentiment_pipeline = [{"$group": {"_id": "$sentiment", "count": {"$sum": 1}}}]
    sentiment_dist = await db.reviews.aggregate(sentiment_pipeline).to_list(10)
    
    y_position = height - 1.5*inch
    
    c.setFont("Helvetica-Bold", 14)
    c.drawString(1*inch, y_position, f"Total Reviews: {total_reviews}")
    y_position -= 0.4*inch
    
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1*inch, y_position, "Sentiment Distribution:")
    y_position -= 0.3*inch
    
    c.setFont("Helvetica", 11)
    for item in sentiment_dist:
        if item["_id"]:
            c.drawString(1.2*inch, y_position, f"• {item['_id'].capitalize()}: {item['count']}")
            y_position -= 0.25*inch
    
    # Get insights
    insights = await db.insights.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)
    
    y_position -= 0.3*inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1*inch, y_position, "Recent Insights:")
    y_position -= 0.3*inch
    
    c.setFont("Helvetica", 10)
    for insight in insights:
        title = insight.get("title", "")[:60]
        c.drawString(1.2*inch, y_position, f"• {title}")
        y_position -= 0.2*inch
        if y_position < 1*inch:
            c.showPage()
            y_position = height - 1*inch
    
    # Footer
    c.setFont("Helvetica", 8)
    c.drawString(1*inch, 0.5*inch, f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    
    c.save()
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=reviewsense_report.pdf"}
    )

# Topic Distribution for charts
@api_router.get("/analytics/topics")
async def get_topic_analytics():
    """Get topic distribution analytics"""
    pipeline = [
        {"$group": {
            "_id": "$topic",
            "count": {"$sum": 1},
            "avg_rating": {"$avg": "$rating"},
            "positive": {"$sum": {"$cond": [{"$eq": ["$sentiment", "positive"]}, 1, 0]}},
            "negative": {"$sum": {"$cond": [{"$eq": ["$sentiment", "negative"]}, 1, 0]}},
            "neutral": {"$sum": {"$cond": [{"$eq": ["$sentiment", "neutral"]}, 1, 0]}}
        }},
        {"$sort": {"count": -1}}
    ]
    
    topics = await db.reviews.aggregate(pipeline).to_list(20)
    
    return {
        "topics": [
            {
                "name": t["_id"] or "Unknown",
                "count": t["count"],
                "avg_rating": round(t["avg_rating"], 2) if t["avg_rating"] else 0,
                "positive": t["positive"],
                "negative": t["negative"],
                "neutral": t["neutral"]
            }
            for t in topics
        ]
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
