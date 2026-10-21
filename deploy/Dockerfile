FROM node:24-alpine
WORKDIR /app
COPY .output/ ./
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
USER 10001
EXPOSE 3000
CMD ["node","server/index.mjs"]
