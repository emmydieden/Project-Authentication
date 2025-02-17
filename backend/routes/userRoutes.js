import express from "express";
import { UserModel } from "../models/User";
import bcrypt from "bcrypt-nodejs";
import listEndpoints from "express-list-endpoints";

const router = express.Router();

// Middleware function to authenticate the user based on the access token in the request header
const authenticateUser = async (req, res, next) => {
  //Retrieve the access token from the request header.
  const accessToken = req.header("Authorization");
  try {
    //Find the user based on the access token
    const user = await UserModel.findOne({ accessToken: accessToken });

    if(!accessToken){
      return res.status(401).json({ error: 'Unauthorized - Access Token is missing' });
    }

    // If user found, add user to the request object and proceed to the next middleware or route
    if (user) {
      req.user = user; //add user to the request object
      next(); //Continue to the next middleware or route
      //If user not found
    } else {
      // If user not found, send a 401 Unauthorized response
      res.status(401).json({ success: false, response: "Please log in" });
    }
  } catch (e) {
    // Handle any errors during authentication and send a 500 Internal Server Error response
    res.status(500).json({ success: false, response: e.message });
  }
};

// -------- Routes starts here -------- //

// Endpoint: GET "/"
// Provides API documentation by listing all available endpoints using express-list-endpoints
router.get("/", (req, res) => {
  const documentation = {
    endpoints: listEndpoints(router),
  };
  res.json(documentation);
});

// Endpoint: POST "/signup"
// Handles user signup. Password is hashed using bcrypt for security.
router.post("/signup", async (req, res) => {
  try {
    // Retrieve user information from the request body
    const { name, userName, password } = req.body; //retrieving user information

    //Checking that user has filled in all fields
    if (!name || !userName || !password) {
      res
        .status(400)
        .json({ success: false, message: "Please fill in all fields" });
      return; //End the function here to prevent further execution
    }

    //Checking that user with same username/name doesn't already exist
    const existingUser = await UserModel.findOne({
      $or: [{ name }, { userName }],
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        message: `User with this ${
          existingUser.userName === userName ? "username" : "name"
        } already exists`,
      });
      return; //End the function here to prevent further execution
    }

    // Hash the password and create a new user in the database
    const user = new UserModel({
      name,
      userName,
      password: bcrypt.hashSync(password),
    });

    //Saving the user to the database
    await user.save();
    res
      .status(201)
      .json({ success: true, id: user._id, accessToken: user.accessToken });
  } catch (err) {
    // Handle errors during signup and send a 400 Bad Request response
    res.status(400).json({
      success: false,
      message: "Could not create user",
      errors: err,
    });
  }
});

// Endpoint: POST "/login"
// Handles user login by checking credentials agains the database.
// Returns user details and access token on successful login; otherwise, returns a notFound status.
router.post("/login", async (req, res) => {
  try {
    // Find the user based on the provided username
    const user = await UserModel.findOne({ userName: req.body.userName });

    if (user) {
      // Check if the provided password matches the stored hashed password
      const passwordMatch = bcrypt.compareSync(
        req.body.password,
        user.password
      );

      // If password is correct, return user details and access token
      if (passwordMatch) {
        res.json({ userId: user._id, accessToken: user.accessToken });
      } else {
        // If password is incorrect, send a 401 Unauthorized response
        res.status(401).json({ success: false, error: "Invalid password" });
      }
    } else {
      // If user not found, send a 404 Not Found response
      res.status(404).json({ success: false, error: "User not found" });
    }
  } catch (error) {
    // Handle errors during login and send a 500 Internal Server Error response
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      repsonse: error.message,
      error: "Internal server error",
    });
  }
});

// An authenticated endpoint which only returns content if the 'Authorization' header with the user's token was correct (will only happen if the next() function is called from the middleware)
router.get("/logged-in", authenticateUser, async (req, res) => {
  try {
    // Return a success response for an authenticated user
    res.status(200).json({ success: true, response: "On secret site" });
  } catch (error) {
    // Handle errors in the '/logged-in' endpoint and send a 401 Unauthorized response
    console.error("Error in /logged-in endpoint:", error);
    res.status(401).json({ success: true, response: error });
  }
});

export default router;
