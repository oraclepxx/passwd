package models

import "errors"

var (
	ErrVaultLocked       = errors.New("vault is locked")
	ErrVaultAlreadyExists = errors.New("vault already exists")
	ErrVaultNotFound     = errors.New("vault not found")
	ErrRecordNotFound    = errors.New("record not found")
	ErrWrongPassword     = errors.New("wrong password")
)
