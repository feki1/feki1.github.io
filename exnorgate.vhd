library ieee;
use ieee.std_logic_1164.all;
entity exnorgate is port (A, B: in std_logic; Z: out std_logic);
end entity exnorgate;

architecture labfour of exnorgate is
component notgate is port (A, B: in std_logic; C: out std_logic); end component;
component andgate is port (A, B: in std_logic; C: out std_logic); end component;
component orgate is port (A, B: in std_logic; C: out std_logic); end component;
signal J, K, L, M, N: std_logic;
begin
G1: notgate port map(A => A, B => A, C => J);
G2: notgate port map(A => B, B => B, C => K);
G3: andgate port map(A => J, B => B, C => L);
G4: andgate port map(A => A, B => K, C => M);
G5: orgate port map(A => L, B => M, C => N);
G6: notgate port map(A => N, B => N, C => Z);
end architecture labfour;
