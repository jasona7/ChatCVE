FROM gcr.io/distroless/static-debian11:debug AS build

# Add a new stage for the final image
FROM scratch

# Copy the ca-certificates.crt file from the build stage
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

# Set the working directory within the container
WORKDIR /tmp

# Copy the "syft" binary from your project directory to the container
COPY syft /

# Define the ARGs for labeling
ARG BUILD_DATE
ARG BUILD_VERSION
ARG VCS_REF
ARG VCS_URL

# Define the image labels
LABEL org.opencontainers.image.created=$BUILD_DATE
LABEL org.opencontainers.image.title="syft"
LABEL org.opencontainers.image.description="CLI tool and library for generating a Software Bill of Materials from container images and filesystems"
LABEL org.opencontainers.image.source=$VCS_URL
LABEL org.opencontainers.image.revision=$VCS_REF
LABEL org.opencontainers.image.vendor="Anchore, Inc."
LABEL org.opencontainers.image.version=$BUILD_VERSION
LABEL org.opencontainers.image.licenses="Apache-2.0"
LABEL io.artifacthub.package.readme-url="https://raw.githubusercontent.com/anchore/syft/main/README.md"
LABEL io.artifacthub.package.logo-url="https://user-images.githubusercontent.com/5199289/136844524-1527b09f-c5cb-4aa9-be54-5aa92a6086c1.png"
LABEL io.artifacthub.package.license="Apache-2.0"

# Set the entry point for the container
ENTRYPOINT ["/syft"]
