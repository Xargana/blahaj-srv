#!/bin/bash
cd /var/server/blahaj-srv
git commit -a -m "auto update"
git pull origin main
chown -R www-data:www-data /var/server/blahaj-srv 
pm2 delete api
pm2 start ecosystem.config.js

