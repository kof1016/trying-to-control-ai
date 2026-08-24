import { Module } from '@nestjs/common';

import { AdditionController } from './addition.controller';

@Module({ controllers: [AdditionController] })
export class AppModule {}
