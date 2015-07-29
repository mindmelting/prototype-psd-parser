var ParsePSD = require('../lib/parse.js');
var expect = require('chai').expect;

describe('Prototype PSD Parser', function() {
  it('Should expose init as a function', function() {
    expect(ParsePSD.init).to.be.a('function');
  });
});
