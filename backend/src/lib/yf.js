const { default: YahooFinance } = require('yahoo-finance2');
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
  validation: { logErrors: false, logOptionsErrors: false },
});
module.exports = yahooFinance;
