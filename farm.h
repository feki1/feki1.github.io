//Header file containing all user-defined function declarations(prototypes)
//Keeps all prototypes consistent across files.
#ifndef FARM_H // if not defined yet
#define FARM_H // then define it
//the above two lines make sure this header's content is included only once

//----function declarations go here----
int GetInput (void);
void Calculate (int weight , int numStudent);
void Display (double weight_farmer , double weight_student);
//-------------------------------------------------

#endif // FARM_H

