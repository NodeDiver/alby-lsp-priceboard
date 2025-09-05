# Use the official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Keep TypeScript as it's needed at runtime for Next.js
RUN npm uninstall --save-dev @types/node @types/react @types/react-dom eslint @eslint/eslintrc autoprefixer postcss tailwindcss

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
