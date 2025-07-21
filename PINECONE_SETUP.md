# Pinecone Integration Setup Guide

## Overview

This guide explains how to set up and use the new Pinecone integration for improved AI retrieval in the Ohm video conferencing app.

## What Changed

The app now uses a **hybrid approach** for AI retrieval:
- **MongoDB**: Stores meeting metadata, transcripts, and summaries
- **Pinecone**: Stores vector embeddings for fast semantic search
- **Hybrid RAG Service**: Combines both for optimal performance

## Prerequisites

1. **Pinecone Account**: Sign up at [pinecone.io](https://pinecone.io)
2. **API Key**: Get your Pinecone API key from the dashboard
3. **Environment Variables**: Add to your `.env.local` file

## Environment Variables

Add these to your `.env.local` file:

```bash
# Vector Database
PINECONE_API_KEY=your_pinecone_api_key_here

# Existing variables (make sure these are set)
MONGODB_URI=your_mongodb_connection_string
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
```

## Setup Steps

### 1. Install Dependencies

Dependencies are already installed with the project:
```bash
npm install  # @pinecone-database/pinecone is included
```

### 2. Test Pinecone Connection

Run the test script to verify everything works:
```bash
npm run test-pinecone
```

This will:
- Initialize the Pinecone index
- Test storing and querying embeddings
- Verify the hybrid RAG service

### 3. Migrate Existing Data (Optional)

If you have existing meetings with embeddings, migrate them to Pinecone:
```bash
npm run migrate-pinecone migrate
```

### 4. Test Migration (Optional)

Test the migration and hybrid RAG service:
```bash
npm run migrate-pinecone test
```

## How It Works

### Hybrid RAG Architecture

```
Query → Embedding → Pinecone Search → MongoDB Metadata → Combined Results
```

1. **Query Processing**: User question is converted to embedding
2. **Semantic Search**: Pinecone finds similar transcript embeddings
3. **Metadata Enrichment**: MongoDB provides meeting context and summaries
4. **Result Combination**: Best results from both sources are merged

### Storage Process

When a meeting ends:
1. **Transcripts** are stored in MongoDB
2. **Embeddings** are generated using OpenAI
3. **Vectors** are stored in Pinecone with metadata
4. **Backup embeddings** are kept in MongoDB

### Query Process

When AI chat is used:
1. **Query embedding** is generated
2. **Pinecone search** finds similar transcripts
3. **MongoDB lookup** gets meeting metadata
4. **Combined context** is sent to AI

## Performance Benefits

- **Faster Search**: Pinecone is optimized for vector similarity
- **Better Relevance**: More accurate semantic matching
- **Scalability**: Handles large amounts of transcript data
- **Reliability**: MongoDB backup ensures data safety

## Monitoring

### Index Statistics
Check Pinecone index status:
```bash
npm run test-pinecone pinecone
```

### Test Queries
Test the hybrid RAG service:
```bash
npm run test-pinecone hybrid
```

## Troubleshooting

### Common Issues

1. **"Pinecone API key not configured"**
   - Add `PINECONE_API_KEY` to your `.env.local` file

2. **"Index failed to become ready"**
   - Wait a few minutes for Pinecone index initialization
   - Check your Pinecone dashboard for index status

3. **"No embeddings found"**
   - Run migration script: `npm run migrate-pinecone migrate`
   - Check that meetings have transcripts in MongoDB

4. **"Vector dimension mismatch"**
   - Ensure you're using OpenAI `text-embedding-3-small` model
   - Index dimension should be 1536

### Debug Commands

```bash
# Test Pinecone connection only
npm run test-pinecone pinecone

# Test hybrid RAG service only
npm run test-pinecone hybrid

# Test migration
npm run migrate-pinecone test

# Full migration
npm run migrate-pinecone migrate
```

## Development

### File Structure

```
lib/
├── pinecone-service.ts       # Pinecone vector operations
├── hybrid-rag-service.ts     # Combined MongoDB + Pinecone
├── ai-chatbot.ts            # Updated to use hybrid service
└── mongodb.ts               # Enhanced with new methods

scripts/
├── migrate-to-pinecone.ts   # Migration script
└── test-pinecone.ts         # Test script
```

### Key Classes

- **PineconeService**: Handles vector storage and search
- **HybridRAGService**: Combines MongoDB and Pinecone
- **AIChatbot**: Updated to use hybrid service

## Production Deployment

1. **Set Environment Variables** in your hosting platform
2. **Run Migration** on first deployment
3. **Monitor Index** usage in Pinecone dashboard
4. **Test Performance** with real queries

## Cost Considerations

- **Pinecone**: Charges based on index size and queries
- **OpenAI**: Charges for embedding generation
- **MongoDB**: Existing storage costs remain

The hybrid approach optimizes for both performance and cost by using each service for its strengths. 