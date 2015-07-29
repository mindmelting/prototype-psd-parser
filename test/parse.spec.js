var ParsePSD = require('../lib/parse.js');
var expect = require('chai').expect;
var sinon = require('sinon');
var fs = require('fs');

describe('Prototype PSD Parser', function() {

  beforeEach(function() {
    sinon.stub(fs, 'writeFile');
  });

  afterEach(function() {
    fs.writeFile.restore();
  });

  

  describe('Init', function() {
    beforeEach(function() {
      sinon.stub(ParsePSD, 'parse');
      sinon.stub(ParsePSD, 'createScreenConfig');
    });

    afterEach(function() {
      ParsePSD.parse.restore();
      ParsePSD.createScreenConfig.restore();
    });

    it('Should expose init as a function', function() {
      expect(ParsePSD.init).to.be.a('function');
    });

    it('Should pass in the correct PSD file path', function(done) {
      ParsePSD.init({
        dir: './test'
      }).then(function() {
        expect(ParsePSD.parse.calledOnce).to.equal(true);
        expect(ParsePSD.parse.calledWith('test/test_desktop.psd')).to.equal(true);
        done();
      });
    });
  });

  
});