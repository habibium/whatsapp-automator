use axum::{
    extract::Request,
    http::{Method, header::HeaderName},
    middleware::Next,
    response::Response,
};

use crate::error::AppError;

static SEC_FETCH_SITE: HeaderName = HeaderName::from_static("sec-fetch-site");

/// Refuses writes that a browser labels as coming from another site, which is what a CSRF attack
/// looks like; the session cookie being SameSite=Lax already covers other domains, this also
/// covers sibling subdomains. Clients that are not browsers send no label and pass.
pub async fn reject_cross_site_writes(request: Request, next: Next) -> Result<Response, AppError> {
    let is_read = matches!(
        *request.method(),
        Method::GET | Method::HEAD | Method::OPTIONS
    );
    let is_cross_site = request
        .headers()
        .get(&SEC_FETCH_SITE)
        .is_some_and(|site| site != "same-origin" && site != "none");

    if is_cross_site && !is_read {
        return Err(AppError::CrossSite);
    }

    Ok(next.run(request).await)
}
