const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    // The post unique pid
    pid: {
      type: Number,
      required: true,
    },
    // The title of the post
    title: {
      type: String,
      required: true,
    },
    // The price of the post
    price: {
      type: Number,
      required: true,
    },
    // The city of the post
    city: {
      type: String,
      required: false,
    },
    // The posts image(s)
    images: {
      type: [String],
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    postedAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Post", postSchema);
