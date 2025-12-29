# GEMINI.md - Thang Shop

## Project Overview

This is a full-stack e-commerce web application called "Thang Shop". It is built with a classic architecture using plain HTML, CSS, and JavaScript for the frontend, and a Node.js backend.

*   **Frontend:** The frontend consists of static HTML files (`index.html`, `cart.html`, `product-detail.html`, etc.) styled with CSS and made interactive with vanilla JavaScript. It communicates with the backend via REST APIs.

*   **Backend:** The backend is a Node.js server using the Express.js framework. It provides a comprehensive set of RESTful APIs to manage users, products, orders, carts, and more. It also handles file uploads for product images and user avatars.

*   **Database:** The application uses MySQL as its database. The complete schema and seed data are available in the `db.sql` file. The database is named `twin_shop`.

## Building and Running

### 1. Database Setup

1.  Make sure you have a MySQL server running.
2.  The application will connect to the database using the following credentials (can be overridden with environment variables `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`):
    *   **Host:** `localhost`
    *   **User:** `root`
    *   **Password:** (empty)
    *   **Database:** `twin_shop`
3.  Import the `db.sql` file into your MySQL server to create the database, tables, and seed data.
    ```sh
    # Example command, you might need to use a GUI tool
    mysql -u root < db.sql
    ```

### 2. Install Dependencies

Install the required Node.js packages.

```sh
npm install
```

### 3. Run the Server

Start the backend server. There is no `start` script in `package.json`, so you must run the server file directly. The server will run at `http://localhost:3000`.

```sh
node server/server.js
```

### 4. Access the Application

Open your web browser and navigate to `http://localhost:3000`.

## Development Conventions

*   **API:** The backend provides a RESTful API. The routes are defined in `server/server.js`.
*   **Static Files:** All frontend assets (HTML, CSS, JS, images) are served statically from the project root directory.
*   **Database Management:** The `db.sql` file is the source of truth for the database schema. Any changes to the database structure should be reflected there.
*   **Dependencies:** Backend dependencies are managed with `npm` and defined in `package.json`. There are no frontend-specific package management tools used.
