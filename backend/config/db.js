import mongoose from 'mongoose';

const dbConnect = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/crew-sync';
  const conn = await mongoose.connect(uri);
  console.log(`[DB] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  return conn;
};

export default dbConnect;
