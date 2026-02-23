# ReviewSense AI - Product Requirements Document

## Original Problem Statement
Create NLP-Based Insights from Unstructured Data for Amazon product review datasets that satisfies:
- Retrieval and summarization
- Topic classification
- Automatically categorize support tickets and feedbacks into actionable categories
- Clustering recurring issues
- Identify customer complaints or requests that the company is not aware of
- Modern tools: sentence transformers, OpenAI embeddings
- Vector databases => retrieval enabling
- Making clusters meaningful to humans
- Decision-making based on system output
- Dashboard/Slack integration for product decisions

## User Personas
1. **Product Managers** - Need to understand customer feedback patterns for roadmap prioritization
2. **Customer Success Teams** - Track recurring issues and proactively address concerns
3. **Business Analysts** - Generate reports and extract actionable insights from review data
4. **Support Teams** - Auto-categorize tickets and route to appropriate teams

## Core Requirements
- Semantic text representation using Sentence Transformers (local, no API cost)
- Claude Sonnet AI for intelligent summarization and insights
- K-means clustering for grouping similar reviews
- Topic classification (10 predefined categories)
- Sentiment analysis (positive/neutral/negative)
- Semantic search using cosine similarity
- Export capabilities (CSV, PDF reports)
- Slack webhook integration for alerts

## Architecture
- **Frontend**: React 19 with Tailwind CSS, Shadcn/UI components, Recharts for visualization
- **Backend**: FastAPI with async support
- **Database**: MongoDB for storing reviews, clusters, insights
- **ML/AI**: Sentence Transformers (all-MiniLM-L6-v2), Claude Sonnet 4.5 via Emergent LLM

## What's Been Implemented
1. **Dashboard** - Overview metrics, topic distribution chart, sentiment pie chart, recent reviews, top products
2. **Topic Explorer** - K-means clustering, scatter plot visualization (PCA-reduced embeddings), cluster filtering
3. **Semantic Search** - Natural language queries with similarity scores
4. **AI Insights** - Claude-powered summaries by cluster/topic, recurring issues detection
5. **Dataset Management** - CSV upload, sample data loading, processing status
6. **Settings** - Slack webhook configuration, export options
7. **Navigation** - Collapsible sidebar with all pages

## Prioritized Backlog

### P0 (Completed)
- [x] Sample data loading with 40 Amazon product reviews
- [x] Sentence Transformer embeddings generation
- [x] K-means clustering with 2-10 cluster support
- [x] Topic classification (10 categories)
- [x] Sentiment analysis
- [x] Semantic search with similarity scores
- [x] Claude AI summarization
- [x] Dashboard with Recharts visualizations
- [x] CSV export functionality
- [x] PDF report generation

### P1 (Future Enhancements)
- [ ] OpenAI embeddings integration (text-embedding-3-small) for comparison
- [ ] Real-time Kaggle dataset download with API credentials
- [ ] Advanced filtering on dashboard (date range, product, rating)
- [ ] Scheduled insight generation with Slack alerts
- [ ] Custom topic labeling for clusters
- [ ] Trend analysis over time

### P2 (Nice to Have)
- [ ] Multi-language support for reviews
- [ ] Competitor comparison analysis
- [ ] Email report scheduling
- [ ] Admin panel for managing multiple datasets
- [ ] API rate limiting and usage tracking

## Next Tasks
1. Add date range filtering to dashboard
2. Implement scheduled cron jobs for automatic insight generation
3. Add product comparison feature
4. Optimize recurring issues detection performance (currently ~35s)
5. Add user-defined cluster labels with AI suggestions
