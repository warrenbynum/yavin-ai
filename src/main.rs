use actix_files as fs;
use actix_web::{web, App, HttpResponse, HttpServer, Result};
use serde::Serialize;
use std::collections::HashMap;
use tera::{Context, Tera};

#[derive(Serialize)]
struct PageData {
    title: String,
    description: String,
    page_id: String,
}

// Home page
async fn index(tmpl: web::Data<Tera>) -> Result<HttpResponse> {
    let mut ctx = Context::new();
    ctx.insert("title", "Yavin – Understanding Artificial Intelligence");
    ctx.insert("page_id", "home");
    
    let body = tmpl
        .render("index.html", &ctx)
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Template error: {}", e)))?;
    
    Ok(HttpResponse::Ok().content_type("text/html").body(body))
}

// Foundations page
async fn foundations(tmpl: web::Data<Tera>) -> Result<HttpResponse> {
    let mut ctx = Context::new();
    ctx.insert("title", "Foundations – Yavin");
    ctx.insert("page_id", "foundations");
    
    let body = tmpl
        .render("foundations.html", &ctx)
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Template error: {}", e)))?;
    
    Ok(HttpResponse::Ok().content_type("text/html").body(body))
}

// Machine Learning page
async fn learning(tmpl: web::Data<Tera>) -> Result<HttpResponse> {
    let mut ctx = Context::new();
    ctx.insert("title", "Machine Learning – Yavin");
    ctx.insert("page_id", "learning");
    
    let body = tmpl
        .render("learning.html", &ctx)
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Template error: {}", e)))?;
    
    Ok(HttpResponse::Ok().content_type("text/html").body(body))
}

// Neural Networks page
async fn neural(tmpl: web::Data<Tera>) -> Result<HttpResponse> {
    let mut ctx = Context::new();
    ctx.insert("title", "Neural Networks – Yavin");
    ctx.insert("page_id", "neural");
    
    let body = tmpl
        .render("neural.html", &ctx)
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Template error: {}", e)))?;
    
    Ok(HttpResponse::Ok().content_type("text/html").body(body))
}

// Deep Learning page
async fn deep(tmpl: web::Data<Tera>) -> Result<HttpResponse> {
    let mut ctx = Context::new();
    ctx.insert("title", "Deep Learning – Yavin");
    ctx.insert("page_id", "deep");
    
    let body = tmpl
        .render("deep.html", &ctx)
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Template error: {}", e)))?;
    
    Ok(HttpResponse::Ok().content_type("text/html").body(body))
}

// Modern AI page
async fn modern(tmpl: web::Data<Tera>) -> Result<HttpResponse> {
    let mut ctx = Context::new();
    ctx.insert("title", "Modern AI – Yavin");
    ctx.insert("page_id", "modern");
    
    let body = tmpl
        .render("modern.html", &ctx)
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Template error: {}", e)))?;
    
    Ok(HttpResponse::Ok().content_type("text/html").body(body))
}

// Ethics page
async fn ethics(tmpl: web::Data<Tera>) -> Result<HttpResponse> {
    let mut ctx = Context::new();
    ctx.insert("title", "Ethics & Society – Yavin");
    ctx.insert("page_id", "ethics");
    
    let body = tmpl
        .render("ethics.html", &ctx)
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Template error: {}", e)))?;
    
    Ok(HttpResponse::Ok().content_type("text/html").body(body))
}

// Glossary page
async fn glossary(tmpl: web::Data<Tera>) -> Result<HttpResponse> {
    let mut ctx = Context::new();
    ctx.insert("title", "Glossary – Yavin");
    ctx.insert("page_id", "glossary");
    
    let body = tmpl
        .render("glossary.html", &ctx)
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Template error: {}", e)))?;
    
    Ok(HttpResponse::Ok().content_type("text/html").body(body))
}

// Mission page
async fn mission(tmpl: web::Data<Tera>) -> Result<HttpResponse> {
    let mut ctx = Context::new();
    ctx.insert("title", "Our Mission – Yavin");
    ctx.insert("page_id", "mission");
    
    let body = tmpl
        .render("mission.html", &ctx)
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Template error: {}", e)))?;
    
    Ok(HttpResponse::Ok().content_type("text/html").body(body))
}

// API endpoint for quiz submission
async fn submit_quiz(form: web::Json<HashMap<String, String>>) -> Result<HttpResponse> {
    // Process quiz answers
    let section = form.get("section").map(|s| s.as_str()).unwrap_or("unknown");
    let score = form.get("score").map(|s| s.as_str()).unwrap_or("0");
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "section": section,
        "score": score
    })))
}

// API endpoint for feedback submission
async fn submit_feedback(form: web::Json<HashMap<String, String>>) -> Result<HttpResponse> {
    // Process feedback
    log::info!("Feedback received: {:?}", form);
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "message": "Thank you for your feedback!"
    })))
}

// API endpoint for Gemini chat
async fn chat_with_gemini(form: web::Json<HashMap<String, String>>) -> Result<HttpResponse> {
    let message = form.get("message").map(|s| s.as_str()).unwrap_or("");
    
    if message.is_empty() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Message is required"
        })));
    }
    
    // Get API key from environment variable
    let api_key = match std::env::var("GEMINI_API_KEY") {
        Ok(key) => key,
        Err(_) => {
            log::warn!("GEMINI_API_KEY not set, returning demo response");
            // Return a helpful demo response if API key not configured
            return Ok(HttpResponse::Ok().json(serde_json::json!({
                "response": "I'm the Yavin AI assistant! To enable me, please set your GEMINI_API_KEY environment variable in Render. For now, I can help you navigate this educational platform. What would you like to learn about AI?"
            })));
        }
    };
    
    // Call Gemini API
    let client = reqwest::Client::new();
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={}",
        api_key
    );
    
    let request_body = serde_json::json!({
        "contents": [{
            "parts": [{
                "text": format!(
                    "You are an AI education assistant on Yavin, a comprehensive AI learning platform. \
                    The user is learning about AI fundamentals, machine learning, neural networks, deep learning, \
                    modern AI systems, and ethics. Provide clear, educational, and encouraging responses. \
                    Keep answers concise but informative. User question: {}",
                    message
                )
            }]
        }],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 500
        }
    });
    
    match client.post(&url)
        .json(&request_body)
        .send()
        .await
    {
        Ok(response) => {
            let status = response.status();
            match response.text().await {
                Ok(body) => {
                    log::info!("Gemini API response status: {}, body: {}", status, body);
                    
                    if !status.is_success() {
                        log::error!("Gemini API error: {}", body);
                        return Ok(HttpResponse::Ok().json(serde_json::json!({
                            "response": "I apologize, but I'm having trouble connecting to my AI brain. Please check that your API key is valid and try again."
                        })));
                    }
                    
                    match serde_json::from_str::<serde_json::Value>(&body) {
                        Ok(json) => {
                            // Try to extract response text
                            let response_text = json.get("candidates")
                                .and_then(|c| c.get(0))
                                .and_then(|c| c.get("content"))
                                .and_then(|c| c.get("parts"))
                                .and_then(|p| p.get(0))
                                .and_then(|p| p.get("text"))
                                .and_then(|t| t.as_str())
                                .unwrap_or_else(|| {
                                    log::warn!("Unexpected Gemini response structure: {}", body);
                                    "I apologize, but I received an unexpected response format. Please try rephrasing your question."
                                });
                            
                            Ok(HttpResponse::Ok().json(serde_json::json!({
                                "response": response_text
                            })))
                        }
                        Err(e) => {
                            log::error!("Failed to parse Gemini JSON: {} - Body: {}", e, body);
                            Ok(HttpResponse::Ok().json(serde_json::json!({
                                "response": "I received a response but couldn't understand the format. Please try again."
                            })))
                        }
                    }
                }
                Err(e) => {
                    log::error!("Failed to read Gemini response body: {}", e);
                    Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Failed to read AI response"
                    })))
                }
            }
        }
        Err(e) => {
            log::error!("Failed to call Gemini API: {}", e);
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "response": "I'm having trouble connecting to the AI service. Please check your internet connection and try again."
            })))
        }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));
    
    log::info!("Starting Yavin AI server...");
    
    // Initialize Tera templating engine
    let tera = match Tera::new("templates/**/*.html") {
        Ok(t) => t,
        Err(e) => {
            log::error!("Tera parsing error(s): {}", e);
            std::process::exit(1);
        }
    };
    
    let tera_data = web::Data::new(tera);
    
    // Bind to 0.0.0.0 in production (Render, Fly, etc), localhost for dev
    let host = std::env::var("RENDER")
        .or(std::env::var("FLY_APP_NAME"))
        .map(|_| "0.0.0.0")
        .unwrap_or("127.0.0.1");
    
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);
    
    let bind_address = (host, port);
    
    log::info!("Binding to {}:{}", bind_address.0, bind_address.1);
    
    HttpServer::new(move || {
        App::new()
            .app_data(tera_data.clone())
            // Static files
            .service(fs::Files::new("/static", "./static"))
            // Routes
            .route("/", web::get().to(index))
            .route("/foundations", web::get().to(foundations))
            .route("/learning", web::get().to(learning))
            .route("/neural", web::get().to(neural))
            .route("/deep", web::get().to(deep))
            .route("/modern", web::get().to(modern))
            .route("/ethics", web::get().to(ethics))
            .route("/glossary", web::get().to(glossary))
            .route("/mission", web::get().to(mission))
            // API endpoints
            .route("/api/quiz", web::post().to(submit_quiz))
            .route("/api/feedback", web::post().to(submit_feedback))
            .route("/api/chat", web::post().to(chat_with_gemini))
    })
    .bind(bind_address)?
    .run()
    .await
}

