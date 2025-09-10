#!/bin/bash

# Install Syft and Grype for ChatCVE Registry-Based Scanning
# No Docker required - these tools work directly with registry APIs

echo "🔧 Installing Syft and Grype for ChatCVE..."
echo "============================================="

# Detect OS
OS=""
ARCH=""
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="darwin"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    echo "Windows detected. Please install manually:"
    echo "1. Download Syft from: https://github.com/anchore/syft/releases"
    echo "2. Download Grype from: https://github.com/anchore/grype/releases"
    echo "3. Add both to your PATH"
    exit 1
else
    echo "Unsupported OS: $OSTYPE"
    exit 1
fi

# Detect architecture
if [[ $(uname -m) == "x86_64" ]]; then
    ARCH="amd64"
elif [[ $(uname -m) == "arm64" || $(uname -m) == "aarch64" ]]; then
    ARCH="arm64"
else
    echo "Unsupported architecture: $(uname -m)"
    exit 1
fi

echo "Detected OS: $OS, Architecture: $ARCH"

# Create temporary directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Install Syft
echo ""
echo "📦 Installing Syft..."
SYFT_VERSION="v1.14.0"  # Update to latest stable
SYFT_URL="https://github.com/anchore/syft/releases/download/${SYFT_VERSION}/syft_${SYFT_VERSION#v}_${OS}_${ARCH}.tar.gz"

echo "Downloading: $SYFT_URL"
curl -sSL "$SYFT_URL" | tar -xz
chmod +x syft

# Install to /usr/local/bin (requires sudo)
if sudo mv syft /usr/local/bin/; then
    echo "✅ Syft installed successfully"
else
    echo "❌ Failed to install Syft"
    exit 1
fi

# Install Grype
echo ""
echo "🔍 Installing Grype..."
GRYPE_VERSION="v0.74.7"  # Update to latest stable
GRYPE_URL="https://github.com/anchore/grype/releases/download/${GRYPE_VERSION}/grype_${GRYPE_VERSION#v}_${OS}_${ARCH}.tar.gz"

echo "Downloading: $GRYPE_URL"
curl -sSL "$GRYPE_URL" | tar -xz
chmod +x grype

# Install to /usr/local/bin (requires sudo)
if sudo mv grype /usr/local/bin/; then
    echo "✅ Grype installed successfully"
else
    echo "❌ Failed to install Grype"
    exit 1
fi

# Cleanup
cd /
rm -rf "$TEMP_DIR"

# Verify installations
echo ""
echo "🧪 Verifying installations..."
echo "Syft version:"
syft version
echo ""
echo "Grype version:"
grype version

echo ""
echo "🎉 Installation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Start ChatCVE: ./start-chatcve.sh"
echo "2. Upload your images.txt file"
echo "3. Run real registry-based vulnerability scans!"
echo ""
echo "💡 No Docker required - uses registry APIs directly!"

