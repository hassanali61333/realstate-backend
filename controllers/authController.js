const jwt = require('jsonwebtoken');
const User = require('../models/User');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TOKEN_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRES });

const userPayload = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
});

// Creates a single token (expires in 7 days) and sends it in the response body.
const sendToken = (res, user, status = 200) => {
  const token = signToken(user._id);
  res.status(status).json({ token, user: userPayload(user) });
};

exports.signup = async (req, res, next) => {
  try {
    const { name, email, password, role, phone } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ message: 'A valid email is required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    if (!['agent', 'buyer'].includes(role)) {
      return res.status(400).json({ message: 'Role must be agent or buyer' });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: 'Email is already registered' });

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      password,
      role,
      phone,
    });

    sendToken(res, user, 201);
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    sendToken(res, user);
  } catch (err) {
    next(err);
  }
};

// Stateless JWT: logout is handled on the client by deleting the stored token.
exports.logout = (req, res) => {
  res.json({ message: 'Logged out' });
};