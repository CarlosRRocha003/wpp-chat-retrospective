# wpp-chat-retrospective
An app to show a spotify like retrospective of a group chat in whatsapp

## Virtual Environment
### To activate
venv/Scripts/activate
### To deactivate
deactivate
### To generate requirements.txt
pip freeze > requirements.txt


## Data Extractor
### To run locally
python main.py

### Run using docker
docker build -t data-extractor:latest .
docker run data-extractor:latest

## Frontend

### Build and Run

#### Locally

npm run dev
npm run build

#### Using Docker

docker build -t frontend:latest .
docker run -p 8080:80 frontend:latest
