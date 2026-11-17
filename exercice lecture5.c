#include <stdio.h>
int a;
int b;
int c;
int * p;
int * q;
int * r;

a=6;
b=2;

p=&b;
q=p;
r=&c;
p=&a;
*q=8;
*r=*p;
*r = a+ *q +*&c;
printf("%d %d %d \n", a,b,c)
printf("%d %d %d \n")
