import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import request = require('supertest');

import { AppModule } from '../src/app.module';

describe('addition API', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('adds two integers', async () => {
    const response = await request(app.getHttpServer())
      .get('/add')
      .query({ a: '1', b: '2' })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual({ result: '3' });
  });

  it('adds arbitrarily large signed integers and returns a canonical result', async () => {
    const response = await request(app.getHttpServer())
      .get('/add')
      .query({
        a: '+0009223372036854775808',
        b: '-9223372036854775807',
      })
      .expect(200);

    expect(response.body).toEqual({ result: '1' });
  });

  it('returns canonical zero', async () => {
    const response = await request(app.getHttpServer())
      .get('/add')
      .query({ a: '+0001', b: '-0001' })
      .expect(200);

    expect(response.body).toEqual({ result: '0' });
  });

  it.each(['', '1.0', '1e3', ' 1', '1 ', '١'])(
    'rejects invalid value %j for either parameter',
    async (invalidValue) => {
      await request(app.getHttpServer())
        .get('/add')
        .query({ a: invalidValue, b: '1' })
        .expect(400);
      await request(app.getHttpServer())
        .get('/add')
        .query({ a: '1', b: invalidValue })
        .expect(400);
    },
  );

  it('rejects missing parameters', async () => {
    await request(app.getHttpServer()).get('/add').query({ a: '1' }).expect(400);
    await request(app.getHttpServer()).get('/add').query({ b: '1' }).expect(400);
  });
});
