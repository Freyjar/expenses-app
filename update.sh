#!/bin/bash
cd /opt/expenses
git pull origin main
source venv/bin/activate
pip install -r requirements.txt --quiet
systemctl restart expenses
echo "Updated at $(date)"
