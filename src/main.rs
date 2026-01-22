use actix_files as fs;
use actix_session::{Session, SessionMiddleware, storage::CookieSessionStore};
use actix_web::{web, App, HttpResponse, HttpServer, Result, cookie::Key};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use argon2::password_hash::SaltString;
use chrono::Utc;
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, postgres::PgPoolOptions};
use std::collections::HashMap;
use tera::{Context, Tera};
use uuid::Uuid;

// ============================================================================
// Data Structures
// ============================================================================

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
struct User {
    id: Uuid,
    email: String,
    #[serde(skip_serializing)]
    password_hash: String,
    name: Option<String>,
    created_at: chrono::DateTime<Utc>,
    streak_days: i32,
    total_xp: i32,
}

#[derive(Debug, Serialize, Deserialize)]
struct UserSession {
    id: Uuid,
    email: String,
    name: Option<String>,
    streak_days: i32,
    total_xp: i32,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
struct UserProgress {
    section_id: String,
    completed: bool,
    quiz_score: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct RegisterRequest {
    email: String,
    password: String,
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Debug, Deserialize)]
struct ProgressUpdate {
    section_id: String,
    completed: bool,
    time_spent: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct QuizSubmission {
    section: String,
    score: i32,
    total: i32,
}

#[derive(Debug, Deserialize)]
struct NewsletterSubscription {
    email: String,
    source: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FeedbackSubmission {
    name: Option<String>,
    email: Option<String>,
    rating: i32,
    message: String,
    page_url: Option<String>,
}

// Section definitions with XP values
const SECTIONS: &[(&str, &str, i32)] = &[
    ("foundations", "Foundations", 100),
    ("learning", "Machine Learning", 150),
    ("neural", "Neural Networks", 150),
    ("deep", "Deep Learning", 200),
    ("modern", "Modern AI", 150),
    ("sequential", "Sequential Flow", 100),
    ("ethics", "Ethics & Society", 100),
    ("glossary", "Glossary", 50),
];

// Badge definitions
#[derive(Debug, Clone, Serialize)]
struct BadgeDefinition {
    id: &'static str,
    name: &'static str,
    description: &'static str,
    icon: &'static str,
    xp_reward: i32,
}

const BADGES: &[BadgeDefinition] = &[
    BadgeDefinition { id: "first_steps", name: "First Steps", description: "Complete your first section", icon: "🚀", xp_reward: 25 },
    BadgeDefinition { id: "quiz_taker", name: "Quiz Taker", description: "Complete your first quiz", icon: "📝", xp_reward: 25 },
    BadgeDefinition { id: "quiz_master", name: "Quiz Master", description: "Score 100% on 3 quizzes", icon: "🏆", xp_reward: 100 },
    BadgeDefinition { id: "code_runner", name: "Code Runner", description: "Run code in the playground", icon: "💻", xp_reward: 25 },
    BadgeDefinition { id: "week_warrior", name: "Week Warrior", description: "Maintain a 7-day streak", icon: "🔥", xp_reward: 100 },
    BadgeDefinition { id: "foundations_complete", name: "Foundation Builder", description: "Complete the Foundations section", icon: "🏗️", xp_reward: 50 },
    BadgeDefinition { id: "ml_complete", name: "ML Explorer", description: "Complete Machine Learning", icon: "🤖", xp_reward: 50 },
    BadgeDefinition { id: "neural_complete", name: "Neural Navigator", description: "Complete Neural Networks", icon: "🧠", xp_reward: 50 },
    BadgeDefinition { id: "deep_complete", name: "Deep Diver", description: "Complete Deep Learning", icon: "🌊", xp_reward: 75 },
    BadgeDefinition { id: "modern_complete", name: "Modern Master", description: "Complete Modern AI", icon: "⚡", xp_reward: 50 },
    BadgeDefinition { id: "ethics_complete", name: "Ethics Expert", description: "Complete Ethics & Society", icon: "⚖️", xp_reward: 50 },
    BadgeDefinition { id: "all_sections", name: "AI Scholar", description: "Complete all learning sections", icon: "🎓", xp_reward: 200 },
    BadgeDefinition { id: "xp_100", name: "Century Club", description: "Earn 100 XP", icon: "💯", xp_reward: 0 },
    BadgeDefinition { id: "xp_500", name: "Rising Star", description: "Earn 500 XP", icon: "⭐", xp_reward: 0 },
    BadgeDefinition { id: "xp_1000", name: "AI Champion", description: "Earn 1000 XP", icon: "👑", xp_reward: 0 },
];

// Search content index
struct SearchEntry {
    section: &'static str,
    title: &'static str,
    url: &'static str,
    keywords: &'static [&'static str],
}

const SEARCH_INDEX: &[SearchEntry] = &[
    SearchEntry { section: "Foundations", title: "What is Computation?", url: "/foundations#computation", keywords: &["computation", "algorithm", "input", "output", "process", "bits", "binary"] },
    SearchEntry { section: "Foundations", title: "Algorithms", url: "/foundations#algorithms", keywords: &["algorithm", "complexity", "efficiency", "sorting", "search", "decomposition"] },
    SearchEntry { section: "Foundations", title: "Traditional vs AI Programming", url: "/foundations#paradigm", keywords: &["traditional", "rules", "programming", "paradigm", "shift", "data"] },
    SearchEntry { section: "Machine Learning", title: "Mitchell's Definition", url: "/learning#definition", keywords: &["mitchell", "definition", "task", "experience", "performance", "learning"] },
    SearchEntry { section: "Machine Learning", title: "Supervised Learning", url: "/learning#supervised", keywords: &["supervised", "labeled", "classification", "regression", "training"] },
    SearchEntry { section: "Machine Learning", title: "Unsupervised Learning", url: "/learning#unsupervised", keywords: &["unsupervised", "clustering", "dimensionality", "patterns", "unlabeled"] },
    SearchEntry { section: "Machine Learning", title: "Reinforcement Learning", url: "/learning#reinforcement", keywords: &["reinforcement", "agent", "reward", "environment", "policy", "action"] },
    SearchEntry { section: "Machine Learning", title: "Gradient Descent", url: "/learning#gradient-descent", keywords: &["gradient", "descent", "optimization", "loss", "learning rate", "convergence"] },
    SearchEntry { section: "Machine Learning", title: "Overfitting", url: "/learning#overfitting", keywords: &["overfitting", "underfitting", "bias", "variance", "regularization", "generalization"] },
    SearchEntry { section: "Neural Networks", title: "Biological Inspiration", url: "/neural#biological", keywords: &["neuron", "biological", "brain", "synapse", "dendrite", "axon"] },
    SearchEntry { section: "Neural Networks", title: "Artificial Neurons", url: "/neural#artificial", keywords: &["perceptron", "weights", "bias", "activation", "artificial neuron"] },
    SearchEntry { section: "Neural Networks", title: "Activation Functions", url: "/neural#activation", keywords: &["activation", "relu", "sigmoid", "tanh", "softmax", "non-linear"] },
    SearchEntry { section: "Neural Networks", title: "Backpropagation", url: "/neural#backprop", keywords: &["backpropagation", "gradient", "chain rule", "derivatives", "training"] },
    SearchEntry { section: "Deep Learning", title: "Convolutional Networks", url: "/deep#cnn", keywords: &["cnn", "convolutional", "convolution", "pooling", "filters", "kernels", "image"] },
    SearchEntry { section: "Deep Learning", title: "Recurrent Networks", url: "/deep#rnn", keywords: &["rnn", "recurrent", "lstm", "gru", "sequence", "memory", "time series"] },
    SearchEntry { section: "Deep Learning", title: "Transformers", url: "/deep#transformers", keywords: &["transformer", "attention", "self-attention", "encoder", "decoder", "bert", "gpt"] },
    SearchEntry { section: "Deep Learning", title: "Attention Mechanism", url: "/deep#attention", keywords: &["attention", "query", "key", "value", "weights", "context"] },
    SearchEntry { section: "Deep Learning", title: "Generative Models", url: "/deep#generative", keywords: &["gan", "generative", "discriminator", "generator", "vae", "diffusion"] },
    SearchEntry { section: "Modern AI", title: "Large Language Models", url: "/modern#llm", keywords: &["llm", "language model", "gpt", "claude", "chatgpt", "tokens", "context"] },
    SearchEntry { section: "Modern AI", title: "Prompt Engineering", url: "/modern#prompts", keywords: &["prompt", "engineering", "few-shot", "zero-shot", "chain of thought"] },
    SearchEntry { section: "Modern AI", title: "Computer Vision", url: "/modern#vision", keywords: &["vision", "image", "object detection", "segmentation", "recognition"] },
    SearchEntry { section: "Modern AI", title: "Recommendation Systems", url: "/modern#recommendations", keywords: &["recommendation", "collaborative", "content-based", "filtering", "cold start"] },
    SearchEntry { section: "Ethics", title: "Bias in AI", url: "/ethics#bias", keywords: &["bias", "fairness", "discrimination", "training data", "representation"] },
    SearchEntry { section: "Ethics", title: "Privacy", url: "/ethics#privacy", keywords: &["privacy", "data", "consent", "surveillance", "anonymization"] },
    SearchEntry { section: "Ethics", title: "Accountability", url: "/ethics#accountability", keywords: &["accountability", "responsibility", "explainability", "transparency", "audit"] },
    SearchEntry { section: "Glossary", title: "AI Glossary", url: "/glossary", keywords: &["glossary", "terms", "definitions", "vocabulary", "concepts"] },
];

// ============================================================================
// Helper Functions
// ============================================================================

fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2.hash_password(password.as_bytes(), &salt)?;
    Ok(hash.to_string())
}

fn verify_password(password: &str, hash: &str) -> bool {
    let parsed_hash = match PasswordHash::new(hash) {
        Ok(h) => h,
        Err(_) => return false,
    };
    Argon2::default().verify_password(password.as_bytes(), &parsed_hash).is_ok()
}

async fn get_user_from_session(session: &Session, pool: &PgPool) -> Option<UserSession> {
    let user_id: Option<String> = session.get("user_id").ok().flatten();
    
    if let Some(id_str) = user_id {
        if let Ok(id) = Uuid::parse_str(&id_str) {
            let user = sqlx::query_as::<_, User>(
                "SELECT id, email, password_hash, name, created_at, streak_days, total_xp 
                 FROM users WHERE id = $1"
            )
            .bind(id)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();
            
            return user.map(|u| UserSession {
                id: u.id,
                email: u.email,
                name: u.name,
                streak_days: u.streak_days,
                total_xp: u.total_xp,
            });
        }
    }
    None
}

async fn update_user_streak(pool: &PgPool, user_id: Uuid) -> Result<i32, sqlx::Error> {
    let today = Utc::now().date_naive();
    
    let user = sqlx::query!(
        "SELECT last_activity_date, streak_days FROM users WHERE id = $1",
        user_id
    )
    .fetch_one(pool)
    .await?;
    
    let new_streak = if let Some(last_date) = user.last_activity_date {
        let days_diff = (today - last_date).num_days();
        if days_diff == 0 {
            user.streak_days.unwrap_or(0)
        } else if days_diff == 1 {
            user.streak_days.unwrap_or(0) + 1
        } else {
            1 // Reset streak
        }
    } else {
        1 // First activity
    };
    
    sqlx::query!(
        "UPDATE users SET streak_days = $1, last_activity_date = $2 WHERE id = $3",
        new_streak,
        today,
        user_id
    )
    .execute(pool)
    .await?;
    
    Ok(new_streak)
}

async fn add_xp(pool: &PgPool, user_id: Uuid, xp: i32) -> Result<i32, sqlx::Error> {
    let result = sqlx::query!(
        "UPDATE users SET total_xp = total_xp + $1 WHERE id = $2 RETURNING total_xp",
        xp,
        user_id
    )
    .fetch_one(pool)
    .await?;
    
    Ok(result.total_xp.unwrap_or(0))
}

// ============================================================================
// Page Handlers
// ============================================================================

async fn render_page(
    tmpl: &Tera,
    template: &str,
    page_id: &str,
    title: &str,
    session: &Session,
    pool: &PgPool,
) -> Result<HttpResponse> {
    let mut ctx = Context::new();
    ctx.insert("title", title);
    ctx.insert("page_id", page_id);
    
    // Check if user is logged in
    if let Some(user) = get_user_from_session(session, pool).await {
        ctx.insert("user", &user);
        ctx.insert("is_logged_in", &true);
        
        // Get user progress
        let progress: Vec<UserProgress> = sqlx::query_as(
            "SELECT section_id, completed, quiz_score FROM user_progress WHERE user_id = $1"
        )
        .bind(user.id)
        .fetch_all(pool)
        .await
        .unwrap_or_default();
        
        let progress_map: HashMap<String, UserProgress> = progress
            .into_iter()
            .map(|p| (p.section_id.clone(), p))
            .collect();
        ctx.insert("progress", &progress_map);
        
        // Calculate completion percentage
        let completed_count = progress_map.values().filter(|p| p.completed).count();
        let total_sections = SECTIONS.len();
        let completion_pct = (completed_count as f32 / total_sections as f32 * 100.0) as i32;
        ctx.insert("completion_percentage", &completion_pct);
    } else {
        ctx.insert("is_logged_in", &false);
    }
    
    let body = tmpl
        .render(template, &ctx)
        .map_err(|e| actix_web::error::ErrorInternalServerError(format!("Template error: {}", e)))?;
    
    Ok(HttpResponse::Ok().content_type("text/html").body(body))
}

// Page route handlers
async fn index(tmpl: web::Data<Tera>, session: Session, pool: web::Data<PgPool>) -> Result<HttpResponse> {
    render_page(&tmpl, "index.html", "home", "Yavin – Understanding Artificial Intelligence", &session, &pool).await
}

async fn foundations(tmpl: web::Data<Tera>, session: Session, pool: web::Data<PgPool>) -> Result<HttpResponse> {
    render_page(&tmpl, "foundations.html", "foundations", "Foundations – Yavin", &session, &pool).await
}

async fn learning(tmpl: web::Data<Tera>, session: Session, pool: web::Data<PgPool>) -> Result<HttpResponse> {
    render_page(&tmpl, "learning.html", "learning", "Machine Learning – Yavin", &session, &pool).await
}

async fn neural(tmpl: web::Data<Tera>, session: Session, pool: web::Data<PgPool>) -> Result<HttpResponse> {
    render_page(&tmpl, "neural.html", "neural", "Neural Networks – Yavin", &session, &pool).await
}

async fn deep(tmpl: web::Data<Tera>, session: Session, pool: web::Data<PgPool>) -> Result<HttpResponse> {
    render_page(&tmpl, "deep.html", "deep", "Deep Learning – Yavin", &session, &pool).await
}

async fn modern(tmpl: web::Data<Tera>, session: Session, pool: web::Data<PgPool>) -> Result<HttpResponse> {
    render_page(&tmpl, "modern.html", "modern", "Modern AI – Yavin", &session, &pool).await
}

async fn sequential(tmpl: web::Data<Tera>, session: Session, pool: web::Data<PgPool>) -> Result<HttpResponse> {
    render_page(&tmpl, "sequential.html", "sequential", "Sequential Flow – Yavin", &session, &pool).await
}

async fn ethics(tmpl: web::Data<Tera>, session: Session, pool: web::Data<PgPool>) -> Result<HttpResponse> {
    render_page(&tmpl, "ethics.html", "ethics", "Ethics & Society – Yavin", &session, &pool).await
}

async fn glossary(tmpl: web::Data<Tera>, session: Session, pool: web::Data<PgPool>) -> Result<HttpResponse> {
    render_page(&tmpl, "glossary.html", "glossary", "Glossary – Yavin", &session, &pool).await
}

async fn mission(tmpl: web::Data<Tera>, session: Session, pool: web::Data<PgPool>) -> Result<HttpResponse> {
    render_page(&tmpl, "mission.html", "mission", "Our Mission – Yavin", &session, &pool).await
}

async fn playground(tmpl: web::Data<Tera>, session: Session, pool: web::Data<PgPool>) -> Result<HttpResponse> {
    render_page(&tmpl, "playground.html", "playground", "Code Playground – Yavin", &session, &pool).await
}

// ============================================================================
// Authentication API
// ============================================================================

async fn register(
    pool: web::Data<PgPool>,
    form: web::Json<RegisterRequest>,
    session: Session,
) -> Result<HttpResponse> {
    // Validate email format
    if !form.email.contains('@') || form.email.len() < 5 {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid email address"
        })));
    }
    
    // Validate password strength
    if form.password.len() < 8 {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Password must be at least 8 characters"
        })));
    }
    
    // Check if email already exists
    let existing = sqlx::query!("SELECT id FROM users WHERE email = $1", form.email)
        .fetch_optional(pool.get_ref())
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    
    if existing.is_some() {
        return Ok(HttpResponse::Conflict().json(serde_json::json!({
            "error": "An account with this email already exists"
        })));
    }
    
    // Hash password
    let password_hash = hash_password(&form.password)
        .map_err(|_| actix_web::error::ErrorInternalServerError("Failed to hash password"))?;
    
    // Create user
    let user_id = Uuid::new_v4();
    sqlx::query!(
        "INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4)",
        user_id,
        form.email,
        password_hash,
        form.name
    )
    .execute(pool.get_ref())
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    
    // Set session
    session.insert("user_id", user_id.to_string())
        .map_err(|_| actix_web::error::ErrorInternalServerError("Session error"))?;
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "message": "Account created successfully",
        "user": {
            "id": user_id,
            "email": form.email,
            "name": form.name
        }
    })))
}

async fn login(
    pool: web::Data<PgPool>,
    form: web::Json<LoginRequest>,
    session: Session,
) -> Result<HttpResponse> {
    let user = sqlx::query_as::<_, User>(
        "SELECT id, email, password_hash, name, created_at, streak_days, total_xp 
         FROM users WHERE email = $1"
    )
    .bind(&form.email)
    .fetch_optional(pool.get_ref())
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    
    let user = match user {
        Some(u) => u,
        None => {
            return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Invalid email or password"
            })));
        }
    };
    
    if !verify_password(&form.password, &user.password_hash) {
        return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Invalid email or password"
        })));
    }
    
    // Update streak
    let new_streak = update_user_streak(pool.get_ref(), user.id).await.unwrap_or(user.streak_days);
    
    // Set session
    session.insert("user_id", user.id.to_string())
        .map_err(|_| actix_web::error::ErrorInternalServerError("Session error"))?;
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "streak_days": new_streak,
            "total_xp": user.total_xp
        }
    })))
}

async fn logout(session: Session) -> Result<HttpResponse> {
    session.purge();
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "message": "Logged out successfully"
    })))
}

async fn get_current_user(session: Session, pool: web::Data<PgPool>) -> Result<HttpResponse> {
    if let Some(user) = get_user_from_session(&session, pool.get_ref()).await {
        // Get progress
        let progress: Vec<UserProgress> = sqlx::query_as(
            "SELECT section_id, completed, quiz_score FROM user_progress WHERE user_id = $1"
        )
        .bind(user.id)
        .fetch_all(pool.get_ref())
        .await
        .unwrap_or_default();
        
        Ok(HttpResponse::Ok().json(serde_json::json!({
            "logged_in": true,
            "user": user,
            "progress": progress
        })))
    } else {
        Ok(HttpResponse::Ok().json(serde_json::json!({
            "logged_in": false
        })))
    }
}

// ============================================================================
// Progress Tracking API
// ============================================================================

async fn update_progress(
    pool: web::Data<PgPool>,
    session: Session,
    form: web::Json<ProgressUpdate>,
) -> Result<HttpResponse> {
    let user = match get_user_from_session(&session, pool.get_ref()).await {
        Some(u) => u,
        None => {
            return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Not logged in"
            })));
        }
    };
    
    // Validate section_id
    let valid_section = SECTIONS.iter().any(|(id, _, _)| *id == form.section_id);
    if !valid_section {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid section ID"
        })));
    }
    
    // Get XP for this section
    let section_xp = SECTIONS.iter()
        .find(|(id, _, _)| *id == form.section_id)
        .map(|(_, _, xp)| *xp)
        .unwrap_or(50);
    
    // Check if already completed
    let existing = sqlx::query!(
        "SELECT completed FROM user_progress WHERE user_id = $1 AND section_id = $2",
        user.id,
        form.section_id
    )
    .fetch_optional(pool.get_ref())
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    
    let was_completed = existing.as_ref().map(|e| e.completed.unwrap_or(false)).unwrap_or(false);
    
    // Upsert progress
    sqlx::query!(
        r#"INSERT INTO user_progress (user_id, section_id, completed, completed_at, time_spent_seconds)
           VALUES ($1, $2, $3, $4, COALESCE($5, 0))
           ON CONFLICT (user_id, section_id)
           DO UPDATE SET 
               completed = EXCLUDED.completed,
               completed_at = CASE WHEN EXCLUDED.completed THEN NOW() ELSE user_progress.completed_at END,
               time_spent_seconds = user_progress.time_spent_seconds + COALESCE($5, 0)"#,
        user.id,
        form.section_id,
        form.completed,
        if form.completed { Some(Utc::now()) } else { None },
        form.time_spent
    )
    .execute(pool.get_ref())
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    
    // Award XP if newly completed
    let mut new_xp = user.total_xp;
    if form.completed && !was_completed {
        new_xp = add_xp(pool.get_ref(), user.id, section_xp).await.unwrap_or(user.total_xp);
    }
    
    // Update streak
    let new_streak = update_user_streak(pool.get_ref(), user.id).await.unwrap_or(user.streak_days);
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "xp_earned": if form.completed && !was_completed { section_xp } else { 0 },
        "total_xp": new_xp,
        "streak_days": new_streak
    })))
}

async fn submit_quiz(
    pool: web::Data<PgPool>,
    session: Session,
    form: web::Json<QuizSubmission>,
) -> Result<HttpResponse> {
    let user = match get_user_from_session(&session, pool.get_ref()).await {
        Some(u) => u,
        None => {
            // Still accept quiz for non-logged-in users, just don't save
            return Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "score": form.score,
                "total": form.total,
                "percentage": (form.score as f32 / form.total as f32 * 100.0) as i32,
                "logged_in": false
            })));
        }
    };
    
    let percentage = (form.score as f32 / form.total as f32 * 100.0) as i32;
    
    // Update quiz score in progress
    sqlx::query!(
        r#"INSERT INTO user_progress (user_id, section_id, quiz_score, quiz_completed_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (user_id, section_id)
           DO UPDATE SET 
               quiz_score = GREATEST(user_progress.quiz_score, EXCLUDED.quiz_score),
               quiz_completed_at = NOW()"#,
        user.id,
        form.section,
        percentage
    )
    .execute(pool.get_ref())
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    
    // Bonus XP for perfect score
    let bonus_xp = if percentage == 100 { 50 } else { 0 };
    if bonus_xp > 0 {
        let _ = add_xp(pool.get_ref(), user.id, bonus_xp).await;
    }
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "score": form.score,
        "total": form.total,
        "percentage": percentage,
        "bonus_xp": bonus_xp,
        "logged_in": true
    })))
}

// ============================================================================
// Newsletter API
// ============================================================================

async fn subscribe_newsletter(
    pool: web::Data<PgPool>,
    form: web::Json<NewsletterSubscription>,
) -> Result<HttpResponse> {
    // Validate email
    if !form.email.contains('@') || form.email.len() < 5 {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Please enter a valid email address"
        })));
    }
    
    // Check if already subscribed
    let existing = sqlx::query!(
        "SELECT id, unsubscribed FROM newsletter_subscribers WHERE email = $1",
        form.email
    )
    .fetch_optional(pool.get_ref())
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    
    if let Some(sub) = existing {
        if sub.unsubscribed.unwrap_or(false) {
            // Re-subscribe
            sqlx::query!(
                "UPDATE newsletter_subscribers SET unsubscribed = false, subscribed_at = NOW() WHERE id = $1",
                sub.id
            )
            .execute(pool.get_ref())
            .await
            .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
            
            return Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "message": "Welcome back! You've been re-subscribed to our newsletter."
            })));
        }
        
        return Ok(HttpResponse::Ok().json(serde_json::json!({
            "success": true,
            "message": "You're already subscribed to our newsletter!"
        })));
    }
    
    // Add new subscriber
    sqlx::query!(
        "INSERT INTO newsletter_subscribers (email, source) VALUES ($1, $2)",
        form.email,
        form.source.as_deref().unwrap_or("website")
    )
    .execute(pool.get_ref())
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "message": "Thanks for subscribing! You'll receive AI insights and updates."
    })))
}

// ============================================================================
// Feedback API
// ============================================================================

async fn submit_feedback(
    pool: web::Data<PgPool>,
    session: Session,
    form: web::Json<FeedbackSubmission>,
) -> Result<HttpResponse> {
    let user = get_user_from_session(&session, pool.get_ref()).await;
    let user_id = user.map(|u| u.id);
    
    sqlx::query!(
        r#"INSERT INTO feedback (user_id, name, email, rating, message, page_url)
           VALUES ($1, $2, $3, $4, $5, $6)"#,
        user_id,
        form.name,
        form.email,
        form.rating,
        form.message,
        form.page_url
    )
    .execute(pool.get_ref())
    .await
    .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "message": "Thank you for your feedback!"
    })))
}

// ============================================================================
// AI Chat API (Gemini Integration)
// ============================================================================

async fn chat_with_gemini(form: web::Json<HashMap<String, String>>) -> Result<HttpResponse> {
    let message = form.get("message").map(|s| s.as_str()).unwrap_or("");
    
    if message.is_empty() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Message is required"
        })));
    }
    
    let api_key = match std::env::var("GEMINI_API_KEY") {
        Ok(key) => key,
        Err(_) => {
            return Ok(HttpResponse::Ok().json(serde_json::json!({
                "response": "I'm the Yavin AI assistant! To enable full AI capabilities, please configure the GEMINI_API_KEY. For now, I can help you navigate this educational platform. What would you like to learn about AI?"
            })));
        }
    };
    
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
    
    match client.post(&url).json(&request_body).send().await {
        Ok(response) => {
            let status = response.status();
            match response.text().await {
                Ok(body) => {
                    if !status.is_success() {
                        return Ok(HttpResponse::Ok().json(serde_json::json!({
                            "response": "I'm having trouble connecting. Please try again."
                        })));
                    }
                    
                    match serde_json::from_str::<serde_json::Value>(&body) {
                        Ok(json) => {
                            let response_text = json.get("candidates")
                                .and_then(|c| c.get(0))
                                .and_then(|c| c.get("content"))
                                .and_then(|c| c.get("parts"))
                                .and_then(|p| p.get(0))
                                .and_then(|p| p.get("text"))
                                .and_then(|t| t.as_str())
                                .unwrap_or("I couldn't process that. Please try rephrasing.");
                            
                            Ok(HttpResponse::Ok().json(serde_json::json!({
                                "response": response_text
                            })))
                        }
                        Err(_) => Ok(HttpResponse::Ok().json(serde_json::json!({
                            "response": "Received an unexpected response. Please try again."
                        })))
                    }
                }
                Err(_) => Ok(HttpResponse::Ok().json(serde_json::json!({
                    "response": "Failed to read AI response. Please try again."
                })))
            }
        }
        Err(_) => Ok(HttpResponse::Ok().json(serde_json::json!({
            "response": "Connection error. Please check your internet and try again."
        })))
    }
}

// ============================================================================
// Badges API
// ============================================================================

#[derive(Debug, Serialize)]
struct UserBadge {
    id: String,
    name: String,
    description: String,
    icon: String,
    earned_at: chrono::DateTime<Utc>,
}

async fn get_user_badges(
    session: Session,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse> {
    let user = match get_user_from_session(&session, pool.get_ref()).await {
        Some(u) => u,
        None => {
            return Ok(HttpResponse::Ok().json(serde_json::json!({
                "badges": [],
                "available": BADGES.iter().map(|b| serde_json::json!({
                    "id": b.id,
                    "name": b.name,
                    "description": b.description,
                    "icon": b.icon
                })).collect::<Vec<_>>()
            })));
        }
    };
    
    // Get earned badges
    let earned: Vec<(String, chrono::DateTime<Utc>)> = sqlx::query_as(
        "SELECT achievement_id, earned_at FROM user_achievements WHERE user_id = $1"
    )
    .bind(user.id)
    .fetch_all(pool.get_ref())
    .await
    .unwrap_or_default();
    
    let earned_ids: std::collections::HashSet<String> = earned.iter().map(|(id, _)| id.clone()).collect();
    
    let user_badges: Vec<UserBadge> = earned.iter()
        .filter_map(|(id, earned_at)| {
            BADGES.iter().find(|b| b.id == id).map(|b| UserBadge {
                id: b.id.to_string(),
                name: b.name.to_string(),
                description: b.description.to_string(),
                icon: b.icon.to_string(),
                earned_at: *earned_at,
            })
        })
        .collect();
    
    let available: Vec<serde_json::Value> = BADGES.iter()
        .filter(|b| !earned_ids.contains(b.id))
        .map(|b| serde_json::json!({
            "id": b.id,
            "name": b.name,
            "description": b.description,
            "icon": b.icon
        }))
        .collect();
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "badges": user_badges,
        "available": available
    })))
}

#[derive(Debug, Deserialize)]
struct BadgeCheckRequest {
    trigger: String,
}

async fn check_badges(
    session: Session,
    pool: web::Data<PgPool>,
    form: web::Json<BadgeCheckRequest>,
) -> Result<HttpResponse> {
    let user = match get_user_from_session(&session, pool.get_ref()).await {
        Some(u) => u,
        None => {
            return Ok(HttpResponse::Ok().json(serde_json::json!({
                "new_badges": []
            })));
        }
    };
    
    // Get current badges
    let current_badges: Vec<String> = sqlx::query_scalar(
        "SELECT achievement_id FROM user_achievements WHERE user_id = $1"
    )
    .bind(user.id)
    .fetch_all(pool.get_ref())
    .await
    .unwrap_or_default();
    
    let current_set: std::collections::HashSet<&str> = current_badges.iter().map(|s| s.as_str()).collect();
    
    // Get user stats for badge checking
    let progress: Vec<UserProgress> = sqlx::query_as(
        "SELECT section_id, completed, quiz_score FROM user_progress WHERE user_id = $1"
    )
    .bind(user.id)
    .fetch_all(pool.get_ref())
    .await
    .unwrap_or_default();
    
    let completed_sections: Vec<&str> = progress.iter()
        .filter(|p| p.completed)
        .map(|p| p.section_id.as_str())
        .collect();
    
    let perfect_quizzes = progress.iter()
        .filter(|p| p.quiz_score == Some(100))
        .count();
    
    let mut new_badges: Vec<&BadgeDefinition> = Vec::new();
    
    // Check each badge condition
    for badge in BADGES {
        if current_set.contains(badge.id) {
            continue;
        }
        
        let earned = match badge.id {
            "first_steps" => !completed_sections.is_empty(),
            "quiz_taker" => progress.iter().any(|p| p.quiz_score.is_some()),
            "quiz_master" => perfect_quizzes >= 3,
            "code_runner" => form.trigger == "code_run",
            "week_warrior" => user.streak_days >= 7,
            "foundations_complete" => completed_sections.contains(&"foundations"),
            "ml_complete" => completed_sections.contains(&"learning"),
            "neural_complete" => completed_sections.contains(&"neural"),
            "deep_complete" => completed_sections.contains(&"deep"),
            "modern_complete" => completed_sections.contains(&"modern"),
            "ethics_complete" => completed_sections.contains(&"ethics"),
            "all_sections" => {
                ["foundations", "learning", "neural", "deep", "modern", "ethics"]
                    .iter().all(|s| completed_sections.contains(s))
            },
            "xp_100" => user.total_xp >= 100,
            "xp_500" => user.total_xp >= 500,
            "xp_1000" => user.total_xp >= 1000,
            _ => false,
        };
        
        if earned {
            // Award badge
            let _ = sqlx::query!(
                "INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                user.id,
                badge.id
            )
            .execute(pool.get_ref())
            .await;
            
            // Award XP
            if badge.xp_reward > 0 {
                let _ = add_xp(pool.get_ref(), user.id, badge.xp_reward).await;
            }
            
            new_badges.push(badge);
        }
    }
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "new_badges": new_badges.iter().map(|b| serde_json::json!({
            "id": b.id,
            "name": b.name,
            "description": b.description,
            "icon": b.icon,
            "xp_reward": b.xp_reward
        })).collect::<Vec<_>>()
    })))
}

// ============================================================================
// Search API
// ============================================================================

#[derive(Debug, Deserialize)]
struct SearchQuery {
    q: String,
}

async fn search_content(query: web::Query<SearchQuery>) -> Result<HttpResponse> {
    let search_term = query.q.to_lowercase();
    
    if search_term.len() < 2 {
        return Ok(HttpResponse::Ok().json(serde_json::json!({
            "results": [],
            "query": query.q
        })));
    }
    
    let results: Vec<serde_json::Value> = SEARCH_INDEX.iter()
        .filter(|entry| {
            entry.title.to_lowercase().contains(&search_term) ||
            entry.section.to_lowercase().contains(&search_term) ||
            entry.keywords.iter().any(|k| k.contains(&search_term))
        })
        .map(|entry| serde_json::json!({
            "title": entry.title,
            "section": entry.section,
            "url": entry.url,
            "keywords": entry.keywords
        }))
        .collect();
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "results": results,
        "query": query.q,
        "count": results.len()
    })))
}

// ============================================================================
// Certificate API
// ============================================================================

async fn get_certificate(
    session: Session,
    pool: web::Data<PgPool>,
) -> Result<HttpResponse> {
    let user = match get_user_from_session(&session, pool.get_ref()).await {
        Some(u) => u,
        None => {
            return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Please log in to access certificates"
            })));
        }
    };
    
    // Get progress
    let progress: Vec<UserProgress> = sqlx::query_as(
        "SELECT section_id, completed, quiz_score FROM user_progress WHERE user_id = $1"
    )
    .bind(user.id)
    .fetch_all(pool.get_ref())
    .await
    .unwrap_or_default();
    
    let completed_sections: Vec<&str> = progress.iter()
        .filter(|p| p.completed)
        .map(|p| p.section_id.as_str())
        .collect();
    
    // Check if eligible for certificate
    let core_sections = ["foundations", "learning", "neural", "deep", "modern", "ethics"];
    let all_complete = core_sections.iter().all(|s| completed_sections.contains(s));
    
    if !all_complete {
        let remaining: Vec<&str> = core_sections.iter()
            .filter(|s| !completed_sections.contains(*s))
            .copied()
            .collect();
        
        return Ok(HttpResponse::Ok().json(serde_json::json!({
            "eligible": false,
            "completed": completed_sections.len(),
            "total": core_sections.len(),
            "remaining": remaining
        })));
    }
    
    // Calculate average quiz score
    let quiz_scores: Vec<i32> = progress.iter()
        .filter_map(|p| p.quiz_score)
        .collect();
    let avg_score = if quiz_scores.is_empty() { 0 } else {
        quiz_scores.iter().sum::<i32>() / quiz_scores.len() as i32
    };
    
    // Generate certificate data
    let cert_id = format!("YAVIN-{}-{}", 
        user.id.to_string()[..8].to_uppercase(),
        Utc::now().format("%Y%m%d")
    );
    
    let user_name = user.name.unwrap_or_else(|| user.email.split('@').next().unwrap_or("Learner").to_string());
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "eligible": true,
        "certificate": {
            "id": cert_id,
            "recipient_name": user_name,
            "recipient_email": user.email,
            "issued_date": Utc::now().format("%B %d, %Y").to_string(),
            "total_xp": user.total_xp,
            "average_quiz_score": avg_score,
            "sections_completed": core_sections.len(),
            "title": "Yavin AI Foundations Certificate",
            "description": "Has successfully completed the Yavin AI comprehensive learning program covering Foundations, Machine Learning, Neural Networks, Deep Learning, Modern AI, and AI Ethics."
        }
    })))
}

// ============================================================================
// Main Server
// ============================================================================

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Load .env file if present
    let _ = dotenvy::dotenv();
    
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));
    
    log::info!("Starting Yavin AI server v0.2.0...");
    
    // Database connection - Railway uses DATABASE_URL or DATABASE_PRIVATE_URL
    let database_url = std::env::var("DATABASE_URL")
        .or_else(|_| std::env::var("DATABASE_PRIVATE_URL"))
        .expect("DATABASE_URL must be set");
    
    log::info!("Connecting to database...");
    
    // Retry connection up to 5 times (Railway DB might take time to be ready)
    let mut pool = None;
    for attempt in 1..=5 {
        match PgPoolOptions::new()
            .max_connections(10)
            .acquire_timeout(std::time::Duration::from_secs(10))
            .connect(&database_url)
            .await
        {
            Ok(p) => {
                pool = Some(p);
                break;
            }
            Err(e) => {
                log::warn!("Database connection attempt {} failed: {}", attempt, e);
                if attempt < 5 {
                    log::info!("Retrying in 3 seconds...");
                    tokio::time::sleep(std::time::Duration::from_secs(3)).await;
                }
            }
        }
    }
    
    let pool = pool.expect("Failed to connect to database after 5 attempts");
    
    log::info!("Connected to database");
    
    // Run migrations / create tables if they don't exist
    log::info!("Running database migrations...");
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            email_verified BOOLEAN DEFAULT FALSE,
            streak_days INTEGER DEFAULT 0,
            last_activity_date DATE,
            total_xp INTEGER DEFAULT 0
        )
    "#).execute(&pool).await.ok();
    
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS user_progress (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            section_id VARCHAR(50) NOT NULL,
            completed BOOLEAN DEFAULT FALSE,
            completed_at TIMESTAMP WITH TIME ZONE,
            time_spent_seconds INTEGER DEFAULT 0,
            quiz_score INTEGER,
            quiz_completed_at TIMESTAMP WITH TIME ZONE,
            UNIQUE(user_id, section_id)
        )
    "#).execute(&pool).await.ok();
    
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS newsletter_subscribers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) UNIQUE NOT NULL,
            subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            source VARCHAR(50) DEFAULT 'website',
            confirmed BOOLEAN DEFAULT FALSE,
            unsubscribed BOOLEAN DEFAULT FALSE,
            unsubscribed_at TIMESTAMP WITH TIME ZONE
        )
    "#).execute(&pool).await.ok();
    
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS user_achievements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            achievement_id VARCHAR(50) NOT NULL,
            earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(user_id, achievement_id)
        )
    "#).execute(&pool).await.ok();
    
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS feedback (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            name VARCHAR(255),
            email VARCHAR(255),
            rating INTEGER CHECK (rating >= 1 AND rating <= 5),
            message TEXT NOT NULL,
            page_url VARCHAR(500),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    "#).execute(&pool).await.ok();
    
    log::info!("Database migrations complete");
    
    // Initialize Tera templating engine
    let tera = match Tera::new("templates/**/*.html") {
        Ok(t) => t,
        Err(e) => {
            log::error!("Tera parsing error(s): {}", e);
            std::process::exit(1);
        }
    };
    
    let tera_data = web::Data::new(tera);
    let pool_data = web::Data::new(pool);
    
    // Session key (use a persistent key in production)
    let session_key = std::env::var("SESSION_SECRET")
        .map(|s| Key::from(s.as_bytes()))
        .unwrap_or_else(|_| Key::generate());
    
    // Server binding
    let host = std::env::var("RENDER")
        .or(std::env::var("FLY_APP_NAME"))
        .map(|_| "0.0.0.0")
        .unwrap_or("127.0.0.1");
    
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);
    
    log::info!("Binding to {}:{}", host, port);
    
    HttpServer::new(move || {
        App::new()
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), session_key.clone())
                    .cookie_secure(false) // Set to true in production with HTTPS
                    .cookie_http_only(true)
                    .build()
            )
            .app_data(tera_data.clone())
            .app_data(pool_data.clone())
            // Static files
            .service(fs::Files::new("/static", "./static"))
            // Page routes
            .route("/", web::get().to(index))
            .route("/foundations", web::get().to(foundations))
            .route("/learning", web::get().to(learning))
            .route("/neural", web::get().to(neural))
            .route("/deep", web::get().to(deep))
            .route("/modern", web::get().to(modern))
            .route("/sequential", web::get().to(sequential))
            .route("/ethics", web::get().to(ethics))
            .route("/glossary", web::get().to(glossary))
            .route("/mission", web::get().to(mission))
            .route("/playground", web::get().to(playground))
            // Auth API
            .route("/api/auth/register", web::post().to(register))
            .route("/api/auth/login", web::post().to(login))
            .route("/api/auth/logout", web::post().to(logout))
            .route("/api/auth/me", web::get().to(get_current_user))
            // Progress API
            .route("/api/progress", web::post().to(update_progress))
            .route("/api/quiz", web::post().to(submit_quiz))
            // Newsletter API
            .route("/api/newsletter", web::post().to(subscribe_newsletter))
            // Feedback API
            .route("/api/feedback", web::post().to(submit_feedback))
            // AI Chat API
            .route("/api/chat", web::post().to(chat_with_gemini))
            // Badges API
            .route("/api/badges", web::get().to(get_user_badges))
            .route("/api/badges/check", web::post().to(check_badges))
            // Search API
            .route("/api/search", web::get().to(search_content))
            // Certificate API
            .route("/api/certificate", web::get().to(get_certificate))
    })
    .bind((host, port))?
    .run()
    .await
}
