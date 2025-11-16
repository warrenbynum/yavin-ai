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
    })
    .bind(bind_address)?
    .run()
    .await
}

