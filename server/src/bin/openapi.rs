use std::{env, fs, path::Path};

use anyhow::bail;

fn main() -> anyhow::Result<()> {
    let is_check = env::args().any(|arg| arg == "--check");
    let (_, api) = server::router();
    let new_json = api.to_pretty_json()?;
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../openapi.json");

    if let Ok(current_json) = fs::read_to_string(&path)
        && current_json == new_json
    {
        println!("openapi.json is up to date");
        return Ok(());
    }

    if is_check {
        bail!("openapi.json is not up to date");
    }

    fs::write(&path, new_json)?;
    println!("openapi.json updated");

    Ok(())
}
