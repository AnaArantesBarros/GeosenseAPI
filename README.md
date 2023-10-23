# GeosenseAPI
API for NASA Space Apps Challenge 2023, created with Flask, and the JavaScript version of it (in progress) for future projects.
<ul><br>
  <li> <strong>app.py:</strong> Flask API</li>
  <li> <strong>api.js:</strong> JavaScript API</li>
  <li> <strong>webScraping.py:</strong> Web scraping information about volcanoes</li>
  <li> <strong>volcanoes.json:</strong> List of all active volcanoes with coordinates</li>
  <li> <strong>api folder:</strong> API made in Next.js</li>
</ul> <br>
The goal of this API is to unify geospatial data and provide information about terrain, temperatures, ultraviolet radiation (UV), earthquakes, and volcanoes. The information used in this API is from:
<ul><br>
  <li> <strong>Volcanoes:</strong> volcano.si.edu</li>
  <li> <strong>Earthquakes:</strong> seismicportal.eu</li>
  <li> <strong>Temperatures and Precipitation:</strong> NASA Power</li>
  <li> <strong>UV Index:</strong> openuv.io</li>
  <li> <strong>Elevation:</strong> OpenTopoData</li>
</ul> <br>

# Sample API Usage Guide

Welcome to the Sample API Usage Guide! This repository contains documentation on how to interact with our API, including the API endpoint, available parameters, and example requests. Whether you're a developer or just curious to see what the API can do, this guide will help you get started.

## API Endpoint

- **API Endpoint:** [https://geosense-api.vercel.app/api/](https://geosense-api.vercel.app/api/)

## Available Parameters

Our API accepts the following parameters for customization:

1. `lon` (number) - Longitude.
2. `lat` (number) - Latitude.


## How to Use the API

1. Make a GET request to the API endpoint: `https://geosense-api.vercel.app/api/`
2. Include the desired parameters in your request. You can pass them in the query string.
   - Example: `https://geosense-api.vercel.app/api/lat,lon`
3. The API will respond with JSON data containing the requested information.

## Example Requests


```http
GET https://geosense-api.vercel.app/api/-22.9064,-47.0616

