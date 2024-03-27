#!/usr/bin/env python3

import subprocess
import json
import datetime
from pathlib import Path
import sqlite3
import logging
from logging.handlers import TimedRotatingFileHandler

# Set up logging with rotation at midnight and keeping 7 days history
logger = logging.getLogger("ChatCVELogger")
logger.setLevel(logging.INFO)
handler = TimedRotatingFileHandler('ChatCVE_logs.log', when="midnight", interval=1, backupCount=7)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s', datefmt='%Y%m%d%H%M%S')
handler.setFormatter(formatter)
logger.addHandler(handler)

def syft_scan(image):
    syft_executable = '/usr/bin/syft'  # Adjust the full path to syft as needed
    try:
        result = subprocess.run([syft_executable, '-o', 'cyclone-dx-json', image], capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"Error executing syft command on image: {image}")
            logger.error(f"Error details: {result.stderr.strip()}")
            return None
        return json.loads(result.stdout)
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing JSON output for image: {image}: {e}")
        return None

def grype_scan(image):
    try:
        result = subprocess.run(['grype', '-o', 'json', image], capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"Error executing grype command on image: {image}: {result.stderr.strip()}")
            return None
        return json.loads(result.stdout)
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing JSON output for image: {image}: {e}")
        return None

def write_to_db(db_name, scan_result, image_name):
    try:
        conn = sqlite3.connect(db_name)
        cursor = conn.cursor()
        for vulnerability in scan_result.get('matches', []):
            name = vulnerability.get('artifact', {}).get('name')
            installed = vulnerability.get('artifact', {}).get('version')
            fixed_in = vulnerability.get('vulnerability', {}).get('fixedInVersion')
            type = vulnerability.get('artifact', {}).get('type')
            vulnerability_id = vulnerability.get('vulnerability', {}).get('id')
            severity = vulnerability.get('vulnerability', {}).get('severity')
            cursor.execute("INSERT INTO app_patrol (NAME, INSTALLED, FIXED_IN, TYPE, VULNERABILITY, SEVERITY, IMAGE_TAG, DATE_ADDED) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))", (name, installed, fixed_in, type, vulnerability_id, severity, image_name))
        conn.commit()
    except sqlite3.Error as e:
        logger.error(f"SQLite error: {e}")
    except Exception as e:
        logger.error(f"Unexpected error when writing to DB: {e}")
    finally:
        conn.close()

if not Path('images.txt').is_file():
    logger.error("The file 'images.txt' does not exist.")
    images = []
else:
    with open('images.txt') as f:
        images = [line.strip() for line in f if line.strip()]

successful_scans = 0
start_time = datetime.datetime.now()

# Adjust the base directory to your project's needs
base_dir = Path(__file__).parent
scan_output_rootdir = base_dir / 'output'
scan_output_sbom_subdir = scan_output_rootdir / 'sbom'
scan_output_summary_subdir = scan_output_rootdir / 'scan_summary'

# Ensure directories exist
scan_output_sbom_subdir.mkdir(parents=True, exist_ok=True)
scan_output_summary_subdir.mkdir(parents=True, exist_ok=True)

for image in images:
    result = syft_scan(image)
    if result is None:
        continue

    now = datetime.datetime.now()
    formatted_now = now.strftime("%Y%m%d")

    # Correct directory for SBOM .json files
    scan_output_sbom_subdir.mkdir(parents=True, exist_ok=True)
    
    filename = image.replace('/', '_').replace(':', '__') + '.json'
    sbom_filename = scan_output_sbom_subdir / f"{formatted_now}_{filename}"  # Corrected path for SBOM files

    try:
        with open(sbom_filename, 'w') as f:  # Use sbom_filename for SBOM files
            json.dump(result, f)
            successful_scans += 1
    except IOError as e:
        logger.error(f"Error writing to file: {sbom_filename}: {e}")

    grype_result = grype_scan(image)
    if grype_result is not None:
        write_to_db('app_patrol.db', grype_result, image)

execution_time = datetime.datetime.now() - start_time
summary = f"Scanned {successful_scans} images\n" \
          f"Results stored in {successful_scans} files\n" \
          f"Total number of images scanned: {len(images)}\n" \
          f"Total execution time: {execution_time}\n"
logger.info(summary)

# Write summary to a file in the scan_summary directory
summary_file_path = scan_output_summary_subdir / f"{now.strftime('%Y%m%d%H%M%S')}_summary.txt"
with open(summary_file_path, 'w') as f:
    f.write(summary)
