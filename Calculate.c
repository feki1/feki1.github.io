
#include "farm.h"
void Calculate(int weight , int numStudent)
{
    double weight_farmer, weight_student;
    weight_farmer = weight /2.0; //use decimal point for 2 so that the division result becomes double_precise
    weight_student = (weight / 2.0)/numStudent;

    Display(weight_farmer,weight_student);// call Display
}
