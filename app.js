//jshint esversion:6
require('dotenv').config();

const findOrCreate = require('mongoose-findorcreate');
const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const port = 3000;
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;


const app = express();
const env = require('dotenv').config;

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended:true
}));

app.set('trust proxy', 1) // trust first proxy

app.use(session({
  secret: 'I believe in the future of agriculture.',
  resave: false,
  saveUninitialized: false,
  cookie: {}
}));

app.use(passport.initialize());
app.use(passport.session());

main().catch(err => console.log(err));

async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/userDB');
}

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String
});

////////////////////////// Plugins ////////////////////////////
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.serializeUser((user,done) => {
    process.nextTick(() => {
        done(null, {id: user._id, username: user.username});
    });
});

passport.deserializeUser((user,done) =>{
    process.nextTick(() => {
        return done(null, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", (req, res) => {
    res.render("home");
})

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });

app.get("/login", (req, res, next) => {
    res.render("login");
});

app.get("/register", (req, res) => {
        res.render("register");
    });

app.get("/secrets", (req, res) => {
    User.find({"secret":{$ne: null}})
        .then(foundUser => {
                res.render("secrets", {usersWithSecrets: foundUser})
        })
        .catch(err => {
            console.log(err);
        })
    });

app.get("/submit", (req,res) => {
    if (req.isAuthenticated()) {
        res.render("submit");
    } else {
        res.redirect("/login")
    }
});

app.get("/logout", (req, res, next) => {
    req.logout(function(err){
        if (err) {
            return next(err);
        }
        res.redirect('/');
    });
});


app.post("/register", async (req,res) => {
    try {
        const registerUser = await User.register(
            {username: req.body.username}, req.body.password
        );

        if (registerUser) {
            passport.authenticate("local") (req, res, function() {
                res.redirect("/secrets");
            });
        } else {
            res.redirect("/register");
        }
    } catch (err) {
        res.send(err);
    }
});

app.post("/login", (req,res) =>{
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, (err) => {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function(){
                res.redirect("/secrets");
            });
        }
    });
}); 

app.post("/submit", (req, res) => {
    console.log(req.user.id);
    User.findById(req.user.id)
    .then(foundUser => {
        if (foundUser) {
            foundUser.secret = req.body.secret;
            return foundUser.save();
        }
        return null;
    })
    .then(() => {
        res.redirect("/secrets");
    })
    .catch(err => {
        console.log(err);
    });
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
})