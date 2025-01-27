# שלב הבנייה
FROM node:18 AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install
COPY . .
RUN yarn build

# שלב ההרצה (Serve)
FROM node:18 AS production
RUN npm install -g serve
WORKDIR /app
COPY --from=build /app/build ./build
EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
