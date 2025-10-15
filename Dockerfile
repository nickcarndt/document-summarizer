# Use the official lightweight Python image.
FROM python:3.11-slim

# Set environment variables for Streamlit
ENV STREAMLIT_SERVER_PORT=8080
ENV STREAMLIT_SERVER_HEADLESS=true
ENV STREAMLIT_BROWSER_GATHER_USAGE_STATS=false

# Set the working directory in the container.
WORKDIR /app

# Copy the requirements file into the container.
COPY requirements.txt .

# Install the dependencies.
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container.
COPY . .

# Expose the port that Streamlit will run on.
EXPOSE 8080

# Set the command to run the Streamlit app.
CMD streamlit run app.py --server.port=8080 --server.address=0.0.0.0