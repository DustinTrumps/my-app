#!/usr/bin/env bash
set -euo pipefail

APP_ID="com.dustin.my-app"
APP_NAME="my-app"
VERSION="0.1.0"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RELEASE_DIR="$PROJECT_DIR/src-tauri/target/release"

FLATPAK_DIR="$SCRIPT_DIR/build"
EXPORT_DIR="$SCRIPT_DIR/export"

echo "==> Building Tauri app for Linux..."
cd "$PROJECT_DIR"
export NO_STRIP=1
export PATH="$HOME/.cache/tauri:$HOME/.local/bin:$PATH"
npm run tauri build

echo "==> Cleaning previous Flatpak build..."
rm -rf "$FLATPAK_DIR" "$EXPORT_DIR"

echo "==> Initializing Flatpak build directory..."
rm -rf "$FLATPAK_DIR"
flatpak build-init \
  "$FLATPAK_DIR" \
  "$APP_ID" \
  org.freedesktop.Sdk//24.08 \
  org.freedesktop.Platform//24.08

echo "==> Installing app files..."
install -Dm755 "$RELEASE_DIR/$APP_NAME" "$FLATPAK_DIR/files/bin/$APP_NAME"
install -Dm644 "$PROJECT_DIR/src-tauri/icons/128x128.png" \
  "$FLATPAK_DIR/files/share/icons/hicolor/128x128/apps/$APP_ID.png"
install -Dm644 "$PROJECT_DIR/src-tauri/icons/icon.png" \
  "$FLATPAK_DIR/files/share/icons/hicolor/scalable/apps/$APP_ID.png"

mkdir -p "$FLATPAK_DIR/files/share/applications"
cat > "$FLATPAK_DIR/files/share/applications/$APP_ID.desktop" << DESKTOP_EOF
[Desktop Entry]
Type=Application
Name=$APP_NAME
Comment=A Tauri App
Exec=$APP_NAME %U
Icon=$APP_ID
Terminal=false
Categories=Utility;
StartupWMClass=$APP_NAME
DESKTOP_EOF

echo "==> Setting up Flatpak metadata..."
FLATPAK_METADATA_DIR="$FLATPAK_DIR/files/share/metainfo"
mkdir -p "$FLATPAK_METADATA_DIR"
cat > "$FLATPAK_METADATA_DIR/$APP_ID.metainfo.xml" << METAINFO_EOF
<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>$APP_ID</id>
  <name>$APP_NAME</name>
  <summary>A Tauri App</summary>
  <developer id="$APP_ID">
    <name>dustin</name>
  </developer>
  <metadata_license>MIT</metadata_license>
  <project_license>MIT</project_license>
  <content_rating type="oars-1.1"/>
</component>
METAINFO_EOF

echo "==> Finishing Flatpak..."
flatpak build-finish \
  --command="$APP_NAME" \
  --socket=x11 \
  --socket=wayland \
  --share=ipc \
  --socket=pulseaudio \
  --share=network \
  --device=dri \
  --talk-name=org.freedesktop.Notifications \
  --filesystem=host \
  --filesystem=xdg-run/gvfsd \
  --env=GDK_BACKEND=x11,wayland \
  "$FLATPAK_DIR"

echo "==> Exporting to repository..."
REPO_DIR="$SCRIPT_DIR/repo"
EXPORT_DIR="$SCRIPT_DIR/export"
mkdir -p "$REPO_DIR" "$EXPORT_DIR"
rm -rf "$REPO_DIR"
flatpak build-export \
  "$REPO_DIR" \
  "$FLATPAK_DIR"

echo "==> Building Flatpak bundle..."
flatpak build-bundle \
  --arch=x86_64 \
  "$REPO_DIR" \
  "$EXPORT_DIR/${APP_NAME}_${VERSION}_x86_64.flatpak" \
  "$APP_ID"

echo ""
echo "==> Copying all bundles to $PROJECT_DIR/builds/..."
BUILDS_DIR="$PROJECT_DIR/builds"
BUNDLE_DIR="$PROJECT_DIR/src-tauri/target/release/bundle"
mkdir -p "$BUILDS_DIR"
cp "$BUNDLE_DIR/deb/${APP_NAME}_${VERSION}_amd64.deb" "$BUILDS_DIR/" 2>/dev/null || true
cp "$BUNDLE_DIR/rpm/${APP_NAME}-${VERSION}-1.x86_64.rpm" "$BUILDS_DIR/" 2>/dev/null || true
cp "$BUNDLE_DIR/appimage/${APP_NAME}_${VERSION}_amd64.AppImage" "$BUILDS_DIR/" 2>/dev/null || true
cp "$EXPORT_DIR/${APP_NAME}_${VERSION}_x86_64.flatpak" "$BUILDS_DIR/" 2>/dev/null || true

echo ""
echo "==> All builds in $BUILDS_DIR/:"
ls -lh "$BUILDS_DIR/"
echo ""