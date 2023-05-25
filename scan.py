import subprocess
import json
import datetime
import os
import sqlite3

def syft_scan(image):
    result = subprocess.run(['syft', '-o', 'cyclone-dx-json', image], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error executing syft command on image: {image}")
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        print(f"Error parsing JSON output for image: {image}")
        return None

def grype_scan(image):
    result = subprocess.run(['grype', '-o', 'json', image], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error executing grype command on image: {image}")
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        print(f"Error parsing JSON output for image: {image}")
        return None

def write_to_db(db_name, scan_result, image_name):
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
    conn.close()

if os.path.isfile('images.txt'):
    with open('images.txt') as f:
        images = [line for line in f.read().splitlines() if line.strip()]
else:
    print("The file 'images.txt' does not exist.")
    images = []

successful_scans = 0
start_time = datetime.datetime.now()
for image in images:
    result = syft_scan(image)
    if result is None:
        continue
    filename = image.replace('/', '_').replace(':', '__') + '.json'
    try:
        with open(filename, 'w') as f:
            json.dump(result, f)
            successful_scans += 1
    except IOError:
        print(f"Error writing to file: {filename}")
    grype_result = grype_scan(image)
    if grype_result is not None:
        write_to_db('app_patrol.db', grype_result, image)

time = datetime.datetime.now()
with open(str(time) + '_summary.txt', 'w') as f:
    f.write('Scanned ' + str(successful_scans) + ' images\n')
    f.write('Results stored in ' + str(successful_scans) + ' files\n')
    f.write('Total number of images scanned: ' + str(len(images)) + '\n')
    f.write('Total execution time: ' + str(datetime.datetime.now() - start_time) + '\n')
