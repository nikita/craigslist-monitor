require("dotenv").config();

const moment = require("moment");
const cheerio = require("cheerio");
const mongoose = require("mongoose");
const rp = require("request-promise");
const Post = require("./models/Post");
const CronJob = require("cron").CronJob;
const areas = require("./areas.json");
const { version } = require("./package.json");

const { MONGODB_URI, DISCORD_WEBHOOK } = process.env;

const keywords = ["KEYWORD_HERE"];

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
  })
  .then(() => {
    console.log("Successfully connected to MongoDB");
  })
  .catch((err) => {
    if (err.name === "MongooseTimeoutError") {
      console.error(
        "MongoDB connection error. Please make sure MongoDB is running.",
        err
      );
    } else {
      console.error(err);
    }
    process.exit();
  });

const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const getPosts = async (url, query) => {
  const response = await rp({
    uri: `${url}&query=${query}`,
    method: "GET",
    headers: {
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": 1,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.89 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-User": "?1",
      "Sec-Fetch-Dest": "document",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "en-US,en;q=0.9",
    },
    proxy: "http://127.0.0.1:6666",
    strictSSL: false,
    gzip: true,
  });

  const $ = cheerio.load(response);

  // All rows of listings
  const rows = $('ul[class="rows"]');

  // Row of listings
  const rowItems = rows.find('li[class="result-row"]');

  rowItems.each(function (i, elem) {
    parsePost($(this));
  });
};

const parsePost = async (postHtml) => {
  // class=result-image gallery
  const imgGalleryDiv = postHtml.find(".result-image");

  let imagesDataIds = imgGalleryDiv.attr("data-ids");

  let images = [];

  // Images in listing
  if (imagesDataIds) {
    imagesDataIds = imagesDataIds.split(",");

    for (const imageDataId of imagesDataIds) {
      images.push(
        `https://images.craigslist.org/${imageDataId.split(":")[1]}_300x300.jpg`
      );
    }
  } else {
    images.push("https://cdn.browshot.com/static/images/not-found.png");
  }

  const post = new Post({
    pid: postHtml.attr("data-pid"),
    title: postHtml.find('a[class="result-title hdrlnk"]').text().trim(),
    price: Number(
      postHtml.find('span[class="result-price"]').first().text().split("$")[1]
    ),
    city:
      postHtml.find('span[class="nearby"]').text().trim() ||
      postHtml.find('span[class="result-hood"]').text().trim() ||
      null,
    images,
    url: imgGalleryDiv.attr("href"),
    // If i construct it with Date() it uses my timezone?
    postedAt: postHtml.find('time[class="result-date"]').attr("datetime"),
  });

  const exists = await Post.findOne({ pid: post.pid });

  if (exists) {
    console.log(`Post with id ${post.pid} already exists`);
  } else {
    console.log(`Post with id ${post.pid} doesn't exist, lets add it`);
    try {
      await post.save();
    } catch (err) {
      console.log(err, post);
    }
    SendWebhook(post);
  }
};

const SendWebhook = ({ title, price, city, images, url }) => {
  rp.post({
    uri: DISCORD_WEBHOOK,
    body: {
      username: "Craiglist Monitor",
      avatar_url:
        "https://encrypted-tbn0.gstatic.com/images?q=tbn%3AANd9GcTU2GLQTYQfP237RU9bs8hihlY87Yvfw8Gl3g",
      embeds: [
        {
          title,
          url,
          fields: [
            {
              name: "Price",
              value: `$${price}`,
              inline: true,
            },
            {
              name: "City",
              value: city,
              inline: true,
            },
          ],
          thumbnail: {
            url: images[0],
          },
          footer: {
            text: `Craigslist v${version} | @Unverifieds [${moment().format()}]`,
          },
        },
      ],
    },
    json: true,
  });
};

const scrape = async () => {
  // Loop through each area
  for (const area of areas) {
    console.log(`Starting to scrape ${area.areaName}`);

    // Loop through each keyword for an area
    for (const keyword of keywords) {
      getPosts(area.url, keyword);
    }

    console.log("Sleeping for 5 seconds");
    await sleep(5000);
  }
};

const job = new CronJob(
  // Every 30 minutes
  "*/30 * * * *",
  async function () {
    console.log("Posting cron job starting now!");
    await scrape();
    this.onComplete();
  },
  async function () {
    console.log(
      `Posting cron job complete! Last Execution: ${this.lastExecution}`
    );
  },
  true,
  "America/Los_Angeles"
);
