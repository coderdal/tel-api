require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

const operatorRoutes = require('./routes/operator');

app.use(cors({
  origin: '*'
}));
app.use(express.json());

app.use('/api', operatorRoutes);

app.use('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'API is running'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Bir hata oluştu',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 