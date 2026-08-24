import { BadRequestException, Controller, Get, Query } from '@nestjs/common';

const DECIMAL_INTEGER = /^[+-]?[0-9]+$/;

@Controller()
export class AdditionController {
  @Get('add')
  add(
    @Query('a') a: string | undefined,
    @Query('b') b: string | undefined,
  ): { result: string } {
    if (!a || !b || !DECIMAL_INTEGER.test(a) || !DECIMAL_INTEGER.test(b)) {
      throw new BadRequestException();
    }
    return { result: (BigInt(a) + BigInt(b)).toString() };
  }
}
