use std::path::PathBuf;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let proto_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("proto");
    let proto_file = proto_dir.join("core.proto");

    tonic_build::configure()
        .build_server(true)
        .build_client(false)
        .compile(&[proto_file], &[&proto_dir])?;

    println!("cargo:rerun-if-changed={}", proto_dir.join("core.proto").display());
    Ok(())
}
