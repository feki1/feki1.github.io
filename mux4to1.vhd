library ieee;
use ieee.std_logic_1164.all;
entity mux4to1 is port (S1, S0, D0, D1, D2, D3: in std_logic; Y: out std_logic);
end entity mux4to1;

architecture labthree of mux4to1 is
component notgate is port (A, B: in std_logic; C: out std_logic); end component;
component andgate is port (A, B: in std_logic; C: out std_logic); end component;
component orgate is port (A, B: in std_logic; C: out std_logic); end component;
signal S0bar, S1bar: std_logic;
signal a0, a1, a2, a3: std_logic;
signal w0, w1, w2, w3: std_logic;
signal or1, or2: std_logic;
begin
G1: notgate port map(A => S0, B => S0, C => S0bar);
G2: notgate port map(A => S1, B => S1, C => S1bar);

G3: andgate port map(A => S1bar, B => S0bar, C => a0);
G4: andgate port map(A => a0,    B => D0,    C => w0);

G5: andgate port map(A => S1bar, B => S0,    C => a1);
G6: andgate port map(A => a1,    B => D1,    C => w1);

G7: andgate port map(A => S1,    B => S0bar, C => a2);
G8: andgate port map(A => a2,    B => D2,    C => w2);

G9: andgate port map(A => S1,    B => S0,    C => a3);
G10: andgate port map(A => a3,   B => D3,    C => w3);

G11: orgate port map(A => w0,  B => w1,  C => or1);
G12: orgate port map(A => w2,  B => w3,  C => or2);
G13: orgate port map(A => or1, B => or2, C => Y);
end architecture labthree;
