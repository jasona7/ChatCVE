from flask import Flask, render_template_string
import json

app = Flask(__name__)

def load_data(filename):
    with open(filename, 'r') as f:
        data = json.load(f)
    return data

@app.route('/')
def sbom_summary():
    # Load data from the given JSON file
    data = load_data('/home/ec2-user/syft/public.ecr.aws_tanzu_observability_demo_app_to-demo_delivery_latest.json')  # Please replace 'yourfile.json' with your actual JSON file name

    # Extract summary data
    summary = []
    for artifact in data.get('artifacts', []):
        summary.append({
            'id': artifact.get('id'),
            'name': artifact.get('name'),
            'version': artifact.get('version'),
            'type': artifact.get('type'),
            'foundBy': artifact.get('foundBy'),
            'language': artifact.get('language'),
            'purl': artifact.get('purl'),
            'architecture': artifact.get('metadata', {}).get('architecture'),
            'mainModule': artifact.get('metadata', {}).get('mainModule'),
        })

    # Render data into HTML
    html_content = '''
    <table border="1">
        <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Version</th>
            <th>Type</th>
            <th>Found By</th>
            <th>Language</th>
            <th>PURL</th>
            <th>Architecture</th>
            <th>Main Module</th>
        </tr>
        {% for item in summary %}
        <tr>
            <td>{{ item.id }}</td>
            <td>{{ item.name }}</td>
            <td>{{ item.version }}</td>
            <td>{{ item.type }}</td>
            <td>{{ item.foundBy }}</td>
            <td>{{ item.language }}</td>
            <td>{{ item.purl }}</td>
            <td>{{ item.architecture }}</td>
            <td>{{ item.mainModule }}</td>
        </tr>
        {% endfor %}
    </table>
    '''
    return render_template_string(html_content, summary=summary)

if __name__ == '__main__':    app.run(host='0.0.0.0', port=5000, debug=True)
