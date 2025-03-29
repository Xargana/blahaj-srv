#!/bin/bash
cd /var/server/blahaj-srv
git commit -a -m "auto update"
git pull origin main -m "auto merge"
chown -R www-data:www-data /var/server/blahaj-srv 
pm2 restart api_status-server