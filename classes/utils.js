const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const randomBetween = (a, b) => {
  return Math.floor(Math.random() * (b - a)) + a;
};

module.exports = { sleep, randomBetween };
