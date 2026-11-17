#define _CRT_SECURE_NO_WARNINGS
#include <stdio.h>
#include "farm.h"
//#include "GetInput.c"
//#include "Calculate.c"
//#include "Display.c"

int main (void)
{
    //Get total strawberry weight and number of students
    int weight , numStudent;
    printf( "Total strawberry weight (in kg):");
    weight = GetInput();
    printf(" Total number of students:");
    numStudent = GetInput();
    Calculate(weight, numStudent); // call Calculate()

    return 0 ;
}

