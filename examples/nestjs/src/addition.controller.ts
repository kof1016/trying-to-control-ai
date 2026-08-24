import { BadRequestException, Controller, Get, Query } from '@nestjs/common';

const DECIMAL_INTEGER = /^[+-]?[0-9]+$/;
const MAX_OPERAND_DIGITS = 1000;

function hasTooManyDigits(value: string): boolean {
  const signLength = value[0] === '+' || value[0] === '-' ? 1 : 0;
  return value.length - signLength > MAX_OPERAND_DIGITS;
}

@Controller()
export class AdditionController {
  @Get('add')
  add(
    @Query('a') a: string | undefined,
    @Query('b') b: string | undefined,
  ): { result: string } {
    if (
      !a ||
      !b ||
      hasTooManyDigits(a) ||
      hasTooManyDigits(b) ||
      !DECIMAL_INTEGER.test(a) ||
      !DECIMAL_INTEGER.test(b)
    ) {
      throw new BadRequestException();
    }
    return { result: (BigInt(a) + BigInt(b)).toString() };
  }
}
