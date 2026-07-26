import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { CharacterDialogComponent } from './character-dialog.component';
import { Player, Character } from '../../../../core/db/database.service';

describe('CharacterDialogComponent', () => {
  let component: CharacterDialogComponent;
  let componentRef: ComponentRef<CharacterDialogComponent>;
  let fixture: ComponentFixture<CharacterDialogComponent>;

  const mockPlayers: Player[] = [
    { id: 1, name: 'Alice', createdAt: new Date() },
    { id: 2, name: 'Bob', createdAt: new Date() },
  ];

  const mockCharacter: Character = {
    id: 10,
    playerId: 1,
    campaignId: 100,
    name: 'Gandalf',
    color: '#8b5cf6',
    isDM: true,
    isActive: true,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CharacterDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CharacterDialogComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should reset values in add mode by default', () => {
    componentRef.setInput('globalPlayers', mockPlayers);
    expect(component.mode()).toBe('add');
    expect(component.globalPlayers().length).toBe(2);
    expect(component.selectedPlayerId()).toBe('new');
    expect(component.newPlayerName()).toBe('');
    expect(component.characterName()).toBe('');
    expect(component.color()).toBe('#f59e0b');
    expect(component.isDM()).toBe(false);
  });

  it('should populate fields in edit mode when character input is provided', () => {
    componentRef.setInput('mode', 'edit');
    componentRef.setInput('character', mockCharacter);
    fixture.detectChanges();

    expect(component.characterName()).toBe('Gandalf');
    expect(component.color()).toBe('#8b5cf6');
    expect(component.isDM()).toBe(true);
  });

  it('should change selected color on selectColor() call', () => {
    component.selectColor('#10b981');
    expect(component.color()).toBe('#10b981');
  });

  it('should emit cancel output on onCancel() call', () => {
    let isCancelled = false;
    component.cancelled.subscribe(() => {
      isCancelled = true;
    });

    component.onCancel();
    expect(isCancelled).toBe(true);
  });

  it('should emit save output on onSave() when inputs are valid', () => {
    let savedData: { playerName: string; characterName: string; color: string; isDM: boolean; selectedPlayerId: string } | null = null;
    component.save.subscribe((data) => {
      savedData = data;
    });

    component.characterName.set('Aragorn');
    component.selectedPlayerId.set('new');
    component.newPlayerName.set('Strider');
    component.color.set('#3b82f6');
    component.isDM.set(false);

    component.onSave();

    expect(savedData).toEqual({
      playerName: 'Strider',
      characterName: 'Aragorn',
      color: '#3b82f6',
      isDM: false,
      selectedPlayerId: 'new',
    });
  });

  it('should not emit save when characterName is empty', () => {
    let savedData: { playerName: string; characterName: string; color: string; isDM: boolean; selectedPlayerId: string } | null = null;
    component.save.subscribe((data) => {
      savedData = data;
    });

    component.characterName.set('   ');
    component.onSave();

    expect(savedData).toBeNull();
  });
});
