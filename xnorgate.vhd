library ieee;
use ieee.std_logic_1164.all;
entity xnorgate is port (A, B: in std_logic; C: out std_logic);
end entity xnorgate;

architecture labone of xnorgate is begin C <= A xnor B;
end architecture labone;
