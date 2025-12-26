# Document Comparer

Compare PDF and DOCX files to identify differences between document versions.

## Requirements

- Python 3.10+

## Installation

```bash
pip install -r requirements.txt
python manage.py migrate
```

## Usage

```bash
python manage.py runserver
```

Open http://localhost:8000

## Production

Configure the following environment variables:

| Variable | Description |
|----------|-------------|
| `DJANGO_SECRET_KEY` | Secret key for cryptographic signing |
| `DJANGO_DEBUG` | Set to `False` in production |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated list of allowed hosts |
